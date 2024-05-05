import { type Rating as OpenskillRating } from "openskill/dist/types";
import { type RatingSystemType } from "../../db/schema/season";
import { getDatePartFromDate, subtractDays } from "../dateUtils";
import { elo, type EloRating } from "./elo";
import { openskill } from "./openskill";

export type Rating = EloRating | OpenskillRating;

export interface RatingSystem<TRating> {
  defaultRating: TRating;
  rateMatch: (match: MatchWithRatings<TRating>) => PlayerWithRating<TRating>[];
  toNumber: (rating: TRating) => number;
}

export interface PlayerWithRating<TRating> {
  player: Player;
  rating: TRating;
}

export type Winner = "Black" | "White" | "Draw";

export interface Match {
  id: number;
  whitePlayerOne: Player;
  whitePlayerTwo: Player | null;
  blackPlayerOne: Player;
  blackPlayerTwo: Player | null;
  result: Winner;
  scoreDiff: number;
  createdAt: Date;
}

export interface MatchWithRatings<TRating> {
  id: number;
  whitePlayerOne: PlayerWithRating<TRating>;
  whitePlayerTwo: PlayerWithRating<TRating> | null;
  blackPlayerOne: PlayerWithRating<TRating>;
  blackPlayerTwo: PlayerWithRating<TRating> | null;
  result: Winner;
  scoreDiff: number;
  createdAt: Date;
}

export function getRatings<TRating>(
  matches: Match[],
  system: RatingSystem<TRating>,
): PlayerWithRating<TRating>[] {
  const ratings: Record<string, PlayerWithRating<TRating>> = {};

  for (const match of matches.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  )) {
    const matchWithRatings: MatchWithRatings<TRating> = {
      ...match,
      whitePlayerOne: ratings[match.whitePlayerOne.id] ?? {
        player: match.whitePlayerOne,
        rating: system.defaultRating,
      },
      whitePlayerTwo: match.whitePlayerTwo
        ? ratings[match.whitePlayerTwo.id] ?? {
            player: match.whitePlayerTwo,
            rating: system.defaultRating,
          }
        : null,
      blackPlayerOne: ratings[match.blackPlayerOne.id] ?? {
        player: match.blackPlayerOne,
        rating: system.defaultRating,
      },
      blackPlayerTwo: match.blackPlayerTwo
        ? ratings[match.blackPlayerTwo.id] ?? {
            player: match.blackPlayerTwo,
            rating: system.defaultRating,
          }
        : null,
    };

    const newRatings = system.rateMatch(matchWithRatings);
    for (const newRating of newRatings) {
      ratings[newRating.player.id] = newRating;
    }
  }

  return Object.values(ratings).toSorted(
    (a, b) => system.toNumber(b.rating) - system.toNumber(a.rating),
  );
}

export function getPlayerRatingHistory<TRating>(
  matches: Match[],
  playerId: string,
  system: RatingSystem<TRating>,
): Record<string, TRating> {
  const ratings: Record<string, PlayerWithRating<TRating>> = {};

  const playersFirstMatch =
    matches.find(
      (match) =>
        match.whitePlayerOne.id === playerId ||
        match.whitePlayerTwo?.id === playerId ||
        match.blackPlayerOne.id === playerId ||
        match.blackPlayerTwo?.id === playerId,
    )?.createdAt ?? new Date();

  const dayBeforePlayersFirstMatch = subtractDays(playersFirstMatch, 1);

  const playerRatingHistory: Record<string, TRating> = {
    [getDatePartFromDate(dayBeforePlayersFirstMatch)]: system.defaultRating,
  };

  for (const match of matches) {
    const matchWithRatings: MatchWithRatings<TRating> = {
      ...match,
      whitePlayerOne: ratings[match.whitePlayerOne.id] ?? {
        player: match.whitePlayerOne,
        rating: system.defaultRating,
      },
      whitePlayerTwo: match.whitePlayerTwo
        ? ratings[match.whitePlayerTwo.id] ?? {
            player: match.whitePlayerTwo,
            rating: system.defaultRating,
          }
        : null,
      blackPlayerOne: ratings[match.blackPlayerOne.id] ?? {
        player: match.blackPlayerOne,
        rating: system.defaultRating,
      },
      blackPlayerTwo: match.blackPlayerTwo
        ? ratings[match.blackPlayerTwo.id] ?? {
            player: match.blackPlayerTwo,
            rating: system.defaultRating,
          }
        : null,
    };

    const newRatings = system.rateMatch(matchWithRatings);
    for (const newRating of newRatings) {
      ratings[newRating.player.id] = newRating;

      if (newRating.player.id === playerId) {
        playerRatingHistory[getDatePartFromDate(match.createdAt)] =
          newRating.rating;
      }
    }
  }

  return playerRatingHistory;
}

export function getRatingSystem(type: RatingSystemType): RatingSystem<Rating> {
  switch (type) {
    case "openskill":
      return openskill() as RatingSystem<Rating>;
    case "elo":
    default:
      return elo() as RatingSystem<Rating>;
  }
}

import { ordinal, rate, rating } from "openskill";
import {
  type Rating as OpenskillRating,
  type Options,
} from "openskill/dist/types";
import {
  type MatchWithRatings,
  type PlayerWithRating,
  type RatingSystem,
} from ".";
import { isDefined } from "../utils";

function rateMatch(
  match: MatchWithRatings<OpenskillRating>,
  selectedOptions: Options,
): PlayerWithRating<OpenskillRating>[] {
  const whiteTeam = [
    match.whitePlayerOne?.rating,
    match.whitePlayerTwo?.rating,
  ].filter(isDefined);

  const blackTeam = [
    match.blackPlayerOne?.rating,
    match.blackPlayerTwo?.rating,
  ].filter(isDefined);

  // Lower is better
  // It makes a difference if the ranking is zero or non-zero, not sure why 🤷
  const outcomeRanking = {
    White: [1, 2],
    Black: [2, 1],
    Draw: [1, 1],
  }[match.result];

  const [
    [whitePlayerOneNewRating, whitePlayerTwoNewRating],
    [blackPlayerOneNewRating, blackPlayerTwoNewRating],
  ] = rate([whiteTeam, blackTeam], {
    ...selectedOptions,
    rank: outcomeRanking,
  });

  const result: PlayerWithRating<OpenskillRating>[] = [
    {
      player: match.whitePlayerOne?.player,
      rating: whitePlayerOneNewRating,
    },
    {
      player: match.blackPlayerOne?.player,
      rating: blackPlayerOneNewRating,
    },
  ].filter((x) => isDefined(x.player)) as PlayerWithRating<OpenskillRating>[];

  if (match.whitePlayerTwo) {
    result.push({
      player: match.whitePlayerTwo.player,
      rating: whitePlayerTwoNewRating,
    });
  }

  if (match.blackPlayerTwo) {
    result.push({
      player: match.blackPlayerTwo?.player,
      rating: blackPlayerTwoNewRating,
    });
  }

  return result;
}

function toNumber(rating: OpenskillRating, selectedOptions: Options) {
  return Math.floor(ordinal(rating, selectedOptions));
}

export function openskill(options?: Options): RatingSystem<OpenskillRating> {
  const selectedOptions: Options = options ?? {
    mu: 1000, // skill level, higher is better
    sigma: 500, // certainty, lower is more certain
    tau: 0.3, // tau prevents model from getting too certain about a players skill level
    z: 2, // used in calculation of ordinal `my - z * sigma`
  };

  return {
    defaultRating: rating(selectedOptions),
    toNumber: (x) => toNumber(x, selectedOptions),
    rateMatch: (x) => rateMatch(x, selectedOptions),
  };
}

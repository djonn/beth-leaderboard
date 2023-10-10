import { eq, inArray, like } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { type Session } from "lucia";
import { HeaderHtml } from "../components/header";
import { LayoutHtml } from "../components/Layout";
import { NavbarHtml } from "../components/Navbar";
import { SearchHtml } from "../components/Search";
import { ctx } from "../context";
import { readClient, type readDb } from "../db";
import { matches, user } from "../db/schema";
import { isHxRequest, notEmpty, redirect } from "../lib";
import { applyMatchResult, matchEloChange } from "../lib/elo";
import { type GameResult } from "../types/elo";

export const match = new Elysia({
  prefix: "/match",
})
  .use(ctx)
  .onBeforeHandle(({ session, headers, set }) => {
    if (!session || !session.user) {
      redirect({ set, headers }, "/api/auth/signin/google");
      return true;
    }
  })
  .get("/", async ({ html, session, headers, readDb }) => {
    return html(() => MatchPage(session, headers, readDb));
  })
  .get(
    "/search",
    async ({ readDb, html, query: { name } }) => {
      const players = await readDb
        .select({ name: user.name, id: user.id })
        .from(user)
        .limit(10)
        .where(like(user.name, `%${name}%`));

      return html(() => matchSearchResults(players));
    },
    {
      query: t.Partial(
        t.Object({
          name: t.String(),
        }),
      ),
    },
  )
  .post(
    "/",
    async ({ html, body, readDb, writeDb }) => {
      console.log("valid body?", body);

      const { white1Id, white2Id, black1Id, black2Id } = body;
      const { match_winner, point_difference } = body;

      const playerArray = [white1Id, white2Id, black1Id, black2Id].filter(
        notEmpty,
      );
      const players = await readDb.query.user.findMany({
        where: inArray(user.id, playerArray),
        columns: {
          id: true,
          elo: true,
        },
      });

      const whiteTeam = players.filter(
        (player) => player.id === white1Id || player.id === white2Id,
      );
      const blackTeam = players.filter(
        (player) => player.id === black1Id || player.id === black2Id,
      );

      const match: GameResult = {
        outcome: mapMatchOutcome(match_winner),
        teams: [
          { color: "White", players: whiteTeam },
          { color: "Black", players: blackTeam },
        ],
      };

      const eloChange = matchEloChange(match);
      applyMatchResult({ eloFloor: 0 }, match);

      type newMatch = typeof matches.$inferInsert;
      const matchInsert: newMatch = {
        result: match_winner,
        scoreDiff: Number(point_difference),
        whiteEloChange: eloChange.white,
        blackEloChange: eloChange.black,
        whitePlayerOne: white1Id,
        whitePlayerTwo: white2Id ? white2Id : null,
        blackPlayerOne: black1Id,
        blackPlayerTwo: black2Id ? black2Id : null,
      };
      console.log(matchInsert);

      await writeDb.transaction(async (trx) => {
        await trx.insert(matches).values(matchInsert);

        for (const team of match.teams) {
          for (const player of team.players) {
            await trx
              .update(user)
              .set({ elo: player.elo })
              .where(eq(user.id, player.id));
          }
        }
      });
      await readClient.sync();
      return html(maForm(readDb));
    },
    {
      beforeHandle: ({ body }) => {
        const playerIds = [
          body.white1Id,
          body.white2Id,
          body.black1Id,
          body.black2Id,
        ].filter((id) => id !== "");

        const uniqueIds = new Set(playerIds);
        if (uniqueIds.size !== playerIds.length) {
          return new Response(
            "The same player can't participate multiple times",
            {
              status: 400,
            },
          );
        }
        if (uniqueIds.size % 2 !== 0) {
          return new Response("You must have an even amount of players", {
            status: 400,
          });
        }
        return;
      },
      body: t.Object({
        white1Id: t.String({ minLength: 1 }),
        white2Id: t.Optional(t.String()),
        black1Id: t.String({ minLength: 1 }),
        black2Id: t.Optional(t.String()),
        match_winner: t.Enum({
          White: "White",
          Black: "Black",
          Draw: "Draw",
        }),
        point_difference: t.String({ minLength: 1 }),
      }),
    },
  );

function mapMatchOutcome(match_winner: "White" | "Black" | "Draw") {
  switch (match_winner) {
    case "White":
      return "win";
    case "Black":
      return "loss";
    case "Draw":
      return "draw";
  }
}

function matchSearchResults(results: { name: string; id: string }[]) {
  return (
    <>
      {results.map((result) => (
        <option value={result.name} id={result.id}>
          {result.name}
        </option>
      ))}
    </>
  );
}

function MatchPage(
  session: Session | null,
  headers: Record<string, string | null>,
  db: typeof readDb,
) {
  return (
    <>
      {isHxRequest(headers) ? (
        MatchForm(session, db)
      ) : (
        <LayoutHtml>{MatchForm(session, db)}</LayoutHtml>
      )}
    </>
  );
}

function MatchForm(session: Session | null, db: typeof readDb) {
  return (
    <>
      <NavbarHtml session={session} activePage="match" />
      <HeaderHtml title="Log match" />
      {maForm(db)}
    </>
  );
}

async function maForm(db: typeof readDb) {
  // const players = await db.select({ name: user.name, id: user.id }).from(user);
  return (
    <>
      <form
        method="post"
        id="matchForm"
        hx-ext="response-targets"
        enctype="multipart/form-data"
        hx-indicator=".progress-bar"
        hx-sync="this:abort"
        hx-swap="outerHTML"
        hx-target="#matchForm"
        hx-params="not name"
        hx-target-400="#errors"
      >
        <input type="hidden" form="matchForm" id="white1Id" name="white1Id" />
        <input type="hidden" form="matchForm" id="white2Id" name="white2Id" />
        <input type="hidden" form="matchForm" id="black1Id" name="black1Id" />
        <input type="hidden" form="matchForm" id="black2Id" name="black2Id" />

        <div class="group relative z-0 mb-6 w-full border-b">
          <span>White team</span>
        </div>
        <div class="group relative z-0 mb-6 w-full">
          <SearchHtml
            hx-swap="innerHtml"
            hx-get="/match/search"
            hx-target="#players1"
            form="matchForm"
            hx-params="name"
            name="name"
            list="players1"
            id="player1"
            class="peer block w-full appearance-none border-0 border-b-2 border-gray-300 bg-transparent px-0 py-2.5 pl-10 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0 dark:border-gray-600 dark:text-white dark:focus:border-blue-500"
            placeholder=" "
            autocomplete="off"
            required="true"
          />
          <label
            for="player1"
            class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform pl-10 text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:pl-0 peer-focus:font-medium peer-focus:text-blue-600 dark:text-gray-400 peer-focus:dark:text-blue-500"
          >
            White player 1
          </label>
        </div>
        {/* <div class="group relative z-0 mb-6 w-full">
          <select
            name="tom-select"
            form="matchForm"
            id="tom-select"
            class="tom-select peer block w-full appearance-none border-0 border-b-2 border-gray-300 bg-transparent px-0 py-2.5 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0 dark:border-gray-600 dark:text-white dark:focus:border-blue-500"
            required="true"
          >
            <option selected="true" disabled></option>
            {matchSearchResults(players)}
          </select>
          <label
            for="tom-select"
            class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:font-medium peer-focus:text-blue-600 dark:text-gray-400 peer-focus:dark:text-blue-500"
          >
            Tom-select
          </label>
        </div> */}
        <div class="group relative z-0 mb-6 w-full">
          <SearchHtml
            hx-swap="innerHtml"
            hx-get="/match/search"
            hx-target="#players2"
            form="matchForm"
            hx-params="name"
            name="name"
            list="players2"
            id="player2"
            class="peer block w-full appearance-none border-0 border-b-2 border-gray-300 bg-transparent px-0 py-2.5 pl-10 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0 dark:border-gray-600 dark:text-white dark:focus:border-blue-500"
            placeholder=" "
            autocomplete="off"
          />
          <label
            for="player2"
            class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform pl-10 text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:pl-0 peer-focus:font-medium peer-focus:text-blue-600 dark:text-gray-400 peer-focus:dark:text-blue-500"
          >
            White player 2 (Optional)
          </label>
        </div>

        <div class="group relative z-0 mb-6 w-full border-b">
          <span>Black team</span>
        </div>

        <div class="group relative z-0 mb-6 w-full">
          <SearchHtml
            hx-swap="innerHtml"
            hx-get="/match/search"
            hx-target="#players3"
            form="matchForm"
            hx-params="name"
            name="name"
            list="players3"
            id="player3"
            class="peer block w-full appearance-none border-0 border-b-2 border-gray-300 bg-transparent px-0 py-2.5 pl-10 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0 dark:border-gray-600 dark:text-white dark:focus:border-blue-500"
            placeholder=" "
            required="true"
            autocomplete="off"
          />
          <label
            for="player4"
            class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform pl-10 text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:pl-0 peer-focus:font-medium peer-focus:text-blue-600 dark:text-gray-400 peer-focus:dark:text-blue-500"
          >
            Black player 1
          </label>
        </div>
        <div class="group relative z-0 mb-6 w-full">
          <SearchHtml
            hx-swap="innerHtml"
            hx-get="/match/search"
            hx-target="#players4"
            form="matchForm"
            hx-params="name"
            name="name"
            list="players4"
            id="player4"
            class="peer block w-full appearance-none border-0 border-b-2 border-gray-300 bg-transparent px-0 py-2.5 pl-10 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0 dark:border-gray-600 dark:text-white dark:focus:border-blue-500"
            placeholder=" "
            autocomplete="off"
          />
          <label
            for="player4"
            class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform pl-10 text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:pl-0 peer-focus:font-medium peer-focus:text-blue-600 dark:text-gray-400 peer-focus:dark:text-blue-500"
          >
            Black player 2 (Optional)
          </label>
        </div>

        <div class="group relative z-0 mb-6 w-full border-b">
          <span>Result</span>
        </div>

        <div class="group relative z-0 mb-6 w-full">
          <select
            name="match_winner"
            form="matchForm"
            id="match_winner"
            class="peer block w-full appearance-none border-0 border-b-2 border-gray-300 bg-transparent px-0 py-2.5 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0 dark:border-gray-600 dark:text-white dark:focus:border-blue-500"
            required="true"
          >
            <option disabled value="" selected="true">
              Select a winner
            </option>
            <option>White</option>
            <option>Black</option>
            <option>Draw</option>
          </select>
          <label
            for="match_winner"
            class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:font-medium peer-focus:text-blue-600 dark:text-gray-400 peer-focus:dark:text-blue-500"
          >
            Match Winner
          </label>
        </div>
        <div class="group relative z-0 mb-6 w-full">
          <input
            type="number"
            form="matchForm"
            name="point_difference"
            id="point_difference"
            class="peer block w-full appearance-none border-0 border-b-2 border-gray-300 bg-transparent px-0 py-2.5 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0 dark:border-gray-600 dark:text-white dark:focus:border-blue-500"
            placeholder=" "
            required="true"
            min="0"
            max="960"
            step="5"
          />
          <label
            for="point_difference"
            class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:font-medium peer-focus:text-blue-600 dark:text-gray-400 peer-focus:dark:text-blue-500"
          >
            Point difference
          </label>
        </div>

        <button
          type="submit"
          class="w-full rounded-lg bg-blue-700 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 sm:w-auto"
        >
          Submit match result
        </button>
        <div id="errors" class="text-red-500"></div>
        <datalist id="players1"></datalist>
        <datalist id="players2"></datalist>
        <datalist id="players3"></datalist>
        <datalist id="players4"></datalist>

        <script>
          {changeEventListener({
            id: "player1",
            datalistId: "players1",
            targetId: "white1Id",
          })}
          {changeEventListener({
            id: "player2",
            datalistId: "players2",
            targetId: "white2Id",
          })}
          {changeEventListener({
            id: "player3",
            datalistId: "players3",
            targetId: "black1Id",
          })}
          {changeEventListener({
            id: "player4",
            datalistId: "players4",
            targetId: "black2Id",
          })}
        </script>
      </form>
    </>
  );
}

function changeEventListener({
  id,
  datalistId,
  targetId,
}: {
  id: string;
  datalistId: string;
  targetId: string;
}): string {
  return `
    document.getElementById("${id}")?.addEventListener("change", function () {
      // Get the selected option from the datalist
      const selectedOption = document.querySelector(\`#${datalistId} option[value='\${this.value}']\`);

      if (selectedOption) {
        // Set the hidden input value to the selected option's data-id
        document.getElementById("${targetId}").value = selectedOption.getAttribute("id") || "";
      } else {
        // Clear the hidden input value if no valid selection is made
        document.getElementById("${targetId}").value = "";
      }
    });`;
}

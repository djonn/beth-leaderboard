import { HxButton } from "./HxButton";

export const LeaderboardRowHtml = async ({
  userId,
  rank,
  name,
  elo,
  first,
  page,
}: {
  userId: string;
  rank: number;
  name: string;
  elo: number;
  first: boolean;
  page: number;
}) => (
  <>
    {first ? (
      <tr
        class="border-b bg-white dark:border-gray-700 dark:bg-gray-800"
        hx-get={`/leaderboard/page/${page + 1}`}
        _="on htmx:afterRequest remove @hx-trigger from me"
        hx-indicator=".progress-bar"
        hx-trigger="intersect once"
        hx-swap="beforeend"
        hx-target={`#nextPageData`}
      >
        <td class="px-1 py-4 pl-2 md:px-3 lg:px-6">{rank}.</td>
        <th
          scope="row"
          class="whitespace-nowrap px-1 py-4 font-medium text-gray-900 dark:text-white md:px-3 lg:px-6"
        >
          <img
            class="mr-1 inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-gray-700 lg:mr-3 lg:h-8 lg:w-8"
            src={`/static/user/${userId}/small`}
            loading="lazy"
            alt=""
          />
          <HxButton hx-get={`/profile/${userId}`}>{name}</HxButton>
        </th>
        <td class="px-1 py-4 md:px-3 lg:px-6">{elo}</td>
      </tr>
    ) : (
      <tr class="border-b bg-white dark:border-gray-700 dark:bg-gray-800">
        <td class="px-1 py-4 pl-2 md:px-3 lg:px-6">{rank}.</td>
        <th
          scope="row"
          class="whitespace-nowrap px-1 py-4 font-medium text-gray-900 dark:text-white md:px-3 lg:px-6"
        >
          <img
            class="mr-1 inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-gray-700 lg:mr-3 lg:h-8 lg:w-8"
            src={`/static/user/${userId}/small`}
            loading="lazy"
            alt=""
          />
          <HxButton hx-get={`/profile/${userId}`}>{name}</HxButton>
        </th>
        <td class="px-1 py-4 md:px-3 lg:px-6">{elo}</td>
      </tr>
    )}
  </>
);

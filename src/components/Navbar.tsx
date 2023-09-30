import { type PropsWithChildren } from "beth-stack/jsx";
import { type Session } from "lucia";

interface PropsWithSession extends PropsWithChildren {
  session: Session | null;
}

export const NavbarHtml = ({ session, children }: PropsWithSession) => (
  <>
    <nav class="border-gray-200 bg-white dark:bg-gray-900">
      <div class="mx-auto flex max-w-screen-xl flex-wrap items-center justify-between p-4">
        <span class="self-center whitespace-nowrap text-2xl font-semibold dark:text-white">
          Crock it
        </span>
        <div>
          <ul class="mt-4 flex flex-col rounded-lg border border-gray-100 bg-gray-50 p-4 font-medium dark:border-gray-700 dark:bg-gray-800 md:mt-0 md:flex-row md:space-x-8 md:border-0 md:bg-white md:p-0 md:dark:bg-gray-900">
            <li>
              {session ? (
                <>
                  <li>Hi! {session.user.name}</li>
                  <li>
                    <a
                      href="/api/auth/signout"
                      class="mt-4 rounded-lg bg-blue-500 px-4 py-2 text-white transition duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50"
                    >
                      Sign Out
                    </a>
                  </li>
                </>
              ) : (
                <a
                  href="/api/auth/signin/google"
                  hx-boost="false"
                  class="mt-4 rounded-lg bg-blue-500 px-4 py-2 text-white transition duration-200 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50"
                >
                  Sign In
                </a>
              )}
            </li>
          </ul>
        </div>
      </div>
    </nav>
    {children}
  </>
);
import { createMemoryHistory, createRootRoute, createRouter, RouterContextProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

/** Supply real navigation context to isolated workspace component tests. */
export function renderWithRouter(element: ReactElement) {
  const router = createRouter({ routeTree: createRootRoute(), history: createMemoryHistory({ initialEntries: ["/monitor"] }) });
  return render(<RouterContextProvider router={router}>{element}</RouterContextProvider>);
}
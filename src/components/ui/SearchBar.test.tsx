import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from "bun:test";
import { Window } from 'happy-dom';
import React from 'react';
import type { SearchResult } from '@/lib/types';

// Mock window and document
const window = new Window({ url: 'http://localhost:3000' });
global.window = window as unknown as Window & typeof globalThis;
global.document = window.document as unknown as Document;
global.navigator = window.navigator as unknown as Navigator;
global.HTMLElement = window.HTMLElement as unknown as typeof HTMLElement;
global.HTMLInputElement = window.HTMLInputElement as unknown as typeof HTMLInputElement;
global.Event = window.Event as unknown as typeof Event;
global.KeyboardEvent = window.KeyboardEvent as unknown as typeof KeyboardEvent;
global.MouseEvent = window.MouseEvent as unknown as typeof MouseEvent;
global.localStorage = window.localStorage as unknown as Storage;
(window as unknown as Window & { SyntaxError: typeof SyntaxError }).SyntaxError = SyntaxError;

// React DOM must see the DOM when it is first imported.
const { act, cleanup, render, waitFor } = await import('@testing-library/react');
const { default: userEvent } = await import('@testing-library/user-event');

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: mock(),
  }),
  usePathname: () => "/",
}));

// Mock next/link
// We need to mock Link to render an actual <a> tag that we can click
// Using a simple functional component for the mock
const MockLink = ({ href, children, onClick }: { href: string, children: React.ReactNode, onClick?: () => void }) => {
    return <a href={href} onClick={onClick} data-testid="link-mock">{children}</a>;
};

mock.module("next/link", () => ({
    default: MockLink,
    __esModule: true,
}));

// Mock supabase
// We need to mock the RPC call
type RpcResponse = {
  data: SearchResult[] | null;
  error: { message: string } | null;
};

const mockRpc = mock<(name: string, args: { search_term: string }) => Promise<RpcResponse>>(
  () => Promise.resolve({ data: [], error: null })
);

mock.module("@/lib/supabase", () => ({
  supabase: {
    rpc: mockRpc,
  },
}));

// Preserve other exports so this mock does not break unrelated UI tests.
const realIcons = { ...await import('lucide-react') };
// Mock lucide-react (icons) as simple components
mock.module("lucide-react", () => ({
  ...realIcons,
  Search: () => <div data-testid="search-icon" />,
  Loader2: () => <div data-testid="loader-icon" />,
  History: () => <div data-testid="history-icon" />,
  LayoutGrid: () => <div data-testid="layout-grid-icon" />,
  X: () => <div data-testid="x-icon" />,
  Menu: () => <div data-testid="menu-icon" />,
  HelpCircle: () => <div data-testid="help-circle-icon" />,
  Layers: () => <div data-testid="layers-icon" />,
  CarFront: () => <div data-testid="car-front-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  ChevronRight: () => <div data-testid="chevron-right-icon" />,
}));

// Keep the real debounce so a response can also arrive between typing and the
// next RPC. Deferred promises control response order independently of that timer.
function deferredResponse() {
  let resolve!: (value: RpcResponse) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<RpcResponse>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function result(name: string, type: SearchResult['Type'] = 'model'): SearchResult {
  return {
    Marque: 'Peugeot',
    Famille: '208',
    Modele: type === 'model' ? name : null,
    Type: type,
    MaxMY: 2024,
    DisplayName: name,
  };
}

async function resolveResults(request: ReturnType<typeof deferredResponse>, results: SearchResult[]) {
  await act(async () => {
    request.resolve({ data: results, error: null });
  });
}

async function setup(props: React.ComponentProps<typeof import('./SearchBar')['default']> = {}) {
  const SearchBar = (await import('./SearchBar')).default;
  const view = render(<SearchBar {...props} />);
  const user = userEvent.setup({ document: window.document as unknown as Document });
  return { ...view, user, input: view.getByRole('textbox') as HTMLInputElement, SearchBar };
}

describe("SearchBar", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockRpc.mockImplementation(() => Promise.resolve({ data: [], error: null }));
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    mock.restore();
  });

  it("renders 'Voir toutes les marques' link and resets state on click", async () => {
    const user = userEvent.setup({ document: window.document as unknown as Document });
    // Dynamic import to ensure mocks are applied before the component is loaded
    const SearchBar = (await import('./SearchBar')).default;

    const { container, findByText, queryByText } = render(<SearchBar />);

    const input = container.querySelector('input');
    expect(input).toBeTruthy();

    // Type a query that will return no results (mocked)
    // We need at least 2 chars for search to trigger
    await user.type(input!, 'unknown');

    // Wait for the real debounce and RPC call.
    await waitFor(() => {
        expect(input!.value).toBe('unknown');
        expect(mockRpc).toHaveBeenCalled();
    });

    // Check if the link is present
    // It appears when results are empty and query >= 2 chars
    // We use findByText which waits/retries
    const link = await findByText("Voir toutes les marques");
    expect(link).toBeTruthy();

    // Verify href
    expect(link.getAttribute('href')).toBe('/marques');

    // Click the link
    await user.click(link);

    // Check if state is reset
    // The dropdown should disappear, so the link should be gone from the document
    await waitFor(() => {
        const linkAfter = queryByText("Voir toutes les marques");
        expect(linkAfter).toBeNull();
    });

    // Check if query is cleared
    expect(input!.value).toBe("");
  });

  it('keeps only the latest results when responses arrive in reverse order', async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    mockRpc.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    const { user, input, getByText, queryByText, queryByTestId } = await setup();

    await user.type(input, 'pe');
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(1));
    await user.type(input, 'u');
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2));
    expect(mockRpc.mock.calls.map(([, args]) => args.search_term)).toEqual(['pe', 'peu']);

    await resolveResults(second, [result('Latest model')]);
    expect(getByText('Latest model')).toBeTruthy();
    expect(queryByTestId('loader-icon')).toBeNull();

    await resolveResults(first, [result('Old model')]);
    expect(getByText('Latest model')).toBeTruthy();
    expect(queryByText('Old model')).toBeNull();
    expect(queryByTestId('loader-icon')).toBeNull();
  });

  it('ignores a response as soon as the query changes, before the next debounce completes', async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    mockRpc.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    const { user, input, queryByText } = await setup();

    await user.type(input, 'pe');
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(1));
    await user.type(input, 'u');
    expect(mockRpc).toHaveBeenCalledTimes(1);

    await resolveResults(first, [result('Old model')]);
    expect(queryByText('Old model')).toBeNull();

    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2));
    await resolveResults(second, [result('Latest model')]);
  });

  it('keeps the debounce when typing away from and back to the previous query', async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    mockRpc.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    const { user, input, queryByText, getByText } = await setup();

    await user.type(input, 'pe');
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(1));
    await user.type(input, 'u');
    await user.keyboard('{Backspace}');
    expect(input.value).toBe('pe');
    expect(mockRpc).toHaveBeenCalledTimes(1);

    await resolveResults(first, [result('Old model')]);
    expect(queryByText('Old model')).toBeNull();
    expect(mockRpc).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2));
    expect(mockRpc.mock.calls.map(([, args]) => args.search_term)).toEqual(['pe', 'pe']);
    await resolveResults(second, [result('Latest model')]);
    expect(getByText('Latest model')).toBeTruthy();
  });

  for (const clearMethod of ['input', 'button', 'below minimum'] as const) {
    it(`does not restore pending results after clearing (${clearMethod})`, async () => {
      const pending = deferredResponse();
      mockRpc.mockImplementationOnce(() => pending.promise);
      const { user, input, getByTestId, queryByText, queryByTestId } = await setup();

      await user.type(input, 'pe');
      await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(1));

      if (clearMethod === 'button') {
        await user.click(getByTestId('x-icon').closest('button')!);
      } else {
        await user.clear(input);
        if (clearMethod === 'below minimum') await user.type(input, 'p');
      }

      expect(input.value).toBe(clearMethod === 'below minimum' ? 'p' : '');
      expect(queryByTestId('loader-icon')).toBeNull();
      await resolveResults(pending, [result('Old model')]);
      expect(queryByText('Old model')).toBeNull();
      expect(queryByText('Résultats')).toBeNull();
      expect(queryByTestId('loader-icon')).toBeNull();
      expect(mockRpc).toHaveBeenCalledTimes(1);
    });
  }

  it('does not stop the current loading state when an obsolete response arrives', async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    mockRpc.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    const { user, input, getByTestId, queryByTestId, queryByText, getByText } = await setup();

    await user.type(input, 'pe');
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(1));
    await user.type(input, 'u');
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2));
    expect(getByTestId('loader-icon')).toBeTruthy();

    await resolveResults(first, [result('Old model')]);
    expect(getByTestId('loader-icon')).toBeTruthy();
    expect(queryByText('Old model')).toBeNull();
    expect(queryByText('Aucun modèle trouvé')).toBeNull();

    await resolveResults(second, [result('Latest model')]);
    expect(getByText('Latest model')).toBeTruthy();
    expect(queryByTestId('loader-icon')).toBeNull();
  });

  for (const failure of ['rpc error', 'rejection'] as const) {
    it(`ignores an obsolete ${failure} while the current search is loading`, async () => {
      const first = deferredResponse();
      const second = deferredResponse();
      mockRpc.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
      const errorLog = spyOn(console, 'error').mockImplementation(() => {});
      const { user, input, getByTestId, queryByTestId, queryByText, getByText } = await setup();

      await user.type(input, 'pe');
      await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(1));
      await user.type(input, 'u');
      await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2));

      await act(async () => {
        if (failure === 'rejection') first.reject(new Error('Obsolete failure'));
        else first.resolve({ data: null, error: { message: 'Obsolete failure' } });
      });

      expect(errorLog).not.toHaveBeenCalled();
      expect(getByTestId('loader-icon')).toBeTruthy();
      expect(queryByText('Aucun modèle trouvé')).toBeNull();

      await resolveResults(second, [result('Latest model')]);
      expect(getByText('Latest model')).toBeTruthy();
      expect(queryByTestId('loader-icon')).toBeNull();
    });
  }

  it('invalidates the pending response when modelOnly changes', async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    mockRpc.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    const { user, input, rerender, SearchBar, getByText, queryByText } = await setup();

    await user.type(input, 'pe');
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(1));
    rerender(<SearchBar modelOnly />);
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2));

    await resolveResults(second, [result('Current family', 'family'), result('Current model')]);
    expect(getByText('Current model')).toBeTruthy();
    expect(queryByText('Current family')).toBeNull();

    await resolveResults(first, [result('Obsolete family', 'family'), result('Obsolete model')]);
    expect(getByText('Current model')).toBeTruthy();
    expect(queryByText('Obsolete family')).toBeNull();
    expect(queryByText('Obsolete model')).toBeNull();
  });

  it('ignores a pending failure after unmounting', async () => {
    const pending = deferredResponse();
    mockRpc.mockImplementationOnce(() => pending.promise);
    const errorLog = spyOn(console, 'error').mockImplementation(() => {});
    const { user, input, unmount } = await setup();

    await user.type(input, 'pe');
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => {
      pending.reject(new Error('Failure after unmount'));
    });

    expect(errorLog).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('preserves keyboard selection and search history with the debounce', async () => {
    const pending = deferredResponse();
    mockRpc.mockImplementationOnce(() => pending.promise);
    const onSelect = mock();
    const selected = result('Selected model');
    const { user, input, getByText, queryByText } = await setup({ onSelect });

    await user.type(input, 'pe');
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(1));
    await resolveResults(pending, [selected]);
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledWith(selected);
    expect(input.value).toBe('');
    expect(queryByText('Résultats')).toBeNull();
    expect(JSON.parse(localStorage.getItem('mcs_search_history')!)).toEqual([selected]);

    await user.click(input);
    expect(getByText('Dernières recherches')).toBeTruthy();
    expect(getByText('Selected model')).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});

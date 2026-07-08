import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { Window } from 'happy-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
const mockRpc = mock(() => Promise.resolve({ data: [], error: null }));

mock.module("@/lib/supabase", () => ({
  supabase: {
    rpc: mockRpc,
  },
}));

// Mock lucid-react (icons) as simple components
mock.module("lucide-react", () => ({
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

// Mock useDebounce to return value immediately to speed up test
mock.module("@/hooks/useDebounce", () => ({
    useDebounce: (value: unknown) => value,
}));


describe("SearchBar", () => {
  beforeEach(() => {
    mockRpc.mockClear();
    document.body.innerHTML = '';
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

    // Wait for the state to update and rpc call (debounced is mocked to immediate)
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
});

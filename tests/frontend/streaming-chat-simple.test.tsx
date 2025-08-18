import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StreamingChat } from '@/components/agent-panel/streaming-chat';

// Mock EventSource
global.EventSource = jest.fn(() => ({
	addEventListener: jest.fn(),
	removeEventListener: jest.fn(),
	close: jest.fn(),
	onerror: jest.fn(),
	onmessage: jest.fn(),
	onopen: jest.fn(),
	readyState: 1,
	url: '',
	withCredentials: false,
	CONNECTING: 0,
	OPEN: 1,
	CLOSED: 2,
}));

describe('StreamingChat Component - Core Functionality', () => {
	const defaultProps = {
		repositoryName: 'test-repo',
		agentType: 'simplifier',
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('renders the component with proper elements', () => {
		render(<StreamingChat {...defaultProps} />);

		// Check for textarea
		const textarea = screen.getByRole('textbox');
		expect(textarea).toBeInTheDocument();
		expect(textarea).toHaveAttribute('placeholder', 'Ask simplifier agent about test-repo...');

		// Check for start button
		const startButton = screen.getByRole('button', { name: /start streaming/i });
		expect(startButton).toBeInTheDocument();
		expect(startButton).toBeDisabled(); // Should be disabled when query is empty

		// Check for repository and agent type display
		expect(screen.getByText('simplifier')).toBeInTheDocument();
		expect(screen.getByText('test-repo')).toBeInTheDocument();
	});

	it('enables start button when query is entered', () => {
		render(<StreamingChat {...defaultProps} />);

		const textarea = screen.getByRole('textbox');
		const startButton = screen.getByRole('button', { name: /start streaming/i });

		// Initially disabled
		expect(startButton).toBeDisabled();

		// Enter text
		fireEvent.change(textarea, { target: { value: 'Test query' } });

		// Should be enabled now
		expect(startButton).not.toBeDisabled();
	});

	it('shows stop button when streaming starts', async () => {
		render(<StreamingChat {...defaultProps} />);

		const textarea = screen.getByRole('textbox');
		fireEvent.change(textarea, { target: { value: 'Test query' } });

		const startButton = screen.getByRole('button', { name: /start streaming/i });
		fireEvent.click(startButton);

		// Should show stop button
		await waitFor(() => {
			const stopButton = screen.getByRole('button', { name: /stop streaming/i });
			expect(stopButton).toBeInTheDocument();
		});

		// Start button should be gone
		expect(screen.queryByRole('button', { name: /start streaming/i })).not.toBeInTheDocument();
	});

	it('disables textarea during streaming', async () => {
		render(<StreamingChat {...defaultProps} />);

		const textarea = screen.getByRole('textbox');
		fireEvent.change(textarea, { target: { value: 'Test query' } });

		const startButton = screen.getByRole('button', { name: /start streaming/i });
		fireEvent.click(startButton);

		// Textarea should be disabled
		await waitFor(() => {
			expect(textarea).toBeDisabled();
		});
	});

	it('shows streaming indicator when streaming', async () => {
		render(<StreamingChat {...defaultProps} />);

		const textarea = screen.getByRole('textbox');
		fireEvent.change(textarea, { target: { value: 'Test query' } });

		const startButton = screen.getByRole('button', { name: /start streaming/i });
		fireEvent.click(startButton);

		// Should show streaming indicator
		await waitFor(() => {
			expect(screen.getByText('Streaming...')).toBeInTheDocument();
		});
	});

	it('stops streaming when stop button is clicked', async () => {
		render(<StreamingChat {...defaultProps} />);

		const textarea = screen.getByRole('textbox');
		fireEvent.change(textarea, { target: { value: 'Test query' } });

		const startButton = screen.getByRole('button', { name: /start streaming/i });
		fireEvent.click(startButton);

		const stopButton = await screen.findByRole('button', { name: /stop streaming/i });
		fireEvent.click(stopButton);

		// Should return to initial state
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /start streaming/i })).toBeInTheDocument();
			expect(textarea).not.toBeDisabled();
		});
	});

	it('handles empty query gracefully', () => {
		render(<StreamingChat {...defaultProps} />);

		const startButton = screen.getByRole('button', { name: /start streaming/i });
		expect(startButton).toBeDisabled();

		// Try to click disabled button
		fireEvent.click(startButton);

		// Should remain disabled and not start streaming
		expect(startButton).toBeDisabled();
		expect(screen.queryByText('Streaming...')).not.toBeInTheDocument();
	});

	it('displays agent response placeholder when not streaming', () => {
		render(<StreamingChat {...defaultProps} />);

		expect(screen.getByText('Agent Response')).toBeInTheDocument();
		expect(screen.getByText('Enter a query and start streaming to see the agent response')).toBeInTheDocument();
	});
}); 
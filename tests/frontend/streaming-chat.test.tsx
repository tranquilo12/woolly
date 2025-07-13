/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StreamingChat } from '@/components/agent-panel/streaming-chat';

// Mock EventSource
class MockEventSource {
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	readyState = EventSource.CONNECTING;
	url: string;

	constructor(url: string) {
		this.url = url;
		this.readyState = EventSource.OPEN;
	}

	close() {
		this.readyState = EventSource.CLOSED;
	}

	dispatchEvent(event: Event): boolean {
		return true;
	}

	addEventListener() { }
	removeEventListener() { }
}

// Mock global EventSource
global.EventSource = MockEventSource as any;

// Mock URL constructor
global.URL = class URL {
	searchParams = new Map();
	origin = 'http://localhost:3000';

	constructor(public href: string, base?: string) {
		this.searchParams = {
			set: jest.fn(),
			get: jest.fn(),
		} as any;
	}

	toString() {
		return this.href;
	}
} as any;

describe('StreamingChat Component', () => {
	const defaultProps = {
		repositoryName: 'test-repo',
		agentType: 'simplifier',
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('Initial Render', () => {
		it('renders the component with correct initial state', () => {
			render(<StreamingChat {...defaultProps} />);

			// Check for query input
			expect(screen.getByPlaceholderText(/Ask simplifier agent about test-repo/)).toBeInTheDocument();

			// Check for agent type and repository badges
			expect(screen.getByText('simplifier')).toBeInTheDocument();
			expect(screen.getByText('test-repo')).toBeInTheDocument();

			// Check for start button
			expect(screen.getByText('Start Streaming')).toBeInTheDocument();

			// Check for empty state
			expect(screen.getByText(/Enter a query and start streaming/)).toBeInTheDocument();
		});

		it('disables start button when query is empty', () => {
			render(<StreamingChat {...defaultProps} />);

			const startButton = screen.getByText('Start Streaming');
			expect(startButton).toBeDisabled();
		});

		it('enables start button when query is entered', () => {
			render(<StreamingChat {...defaultProps} />);

			const textarea = screen.getByPlaceholderText(/Ask simplifier agent about test-repo/);
			fireEvent.change(textarea, { target: { value: 'Test query' } });

			const startButton = screen.getByText('Start Streaming');
			expect(startButton).not.toBeDisabled();
		});
	});

	describe('Stream Event Rendering', () => {
		let mockEventSource: MockEventSource;

		beforeEach(() => {
			mockEventSource = new MockEventSource('test-url');
			jest.spyOn(global, 'EventSource').mockImplementation(() => mockEventSource);
		});

		it('renders start event correctly', async () => {
			render(<StreamingChat {...defaultProps} />);

			const textarea = screen.getByPlaceholderText(/Ask simplifier agent about test-repo/);
			fireEvent.change(textarea, { target: { value: 'Test query' } });

			const startButton = screen.getByText('Start Streaming');
			fireEvent.click(startButton);

			// Simulate start event
			act(() => {
				const startEvent = new MessageEvent('message', {
					data: JSON.stringify({
						id: '1',
						event: 'start',
						data: {
							budget_status: {
								tool_calls_made: 0,
								max_tool_calls: 10,
								elapsed_time: 0,
								time_budget_s: 120,
								convergence_detected: false,
								confidence_avg: 0.8
							}
						},
						timestamp: new Date().toISOString()
					})
				});

				if (mockEventSource.onmessage) {
					mockEventSource.onmessage(startEvent);
				}
			});

			await waitFor(() => {
				expect(screen.getByText('Started')).toBeInTheDocument();
				expect(screen.getByText('Tool Budget Status')).toBeInTheDocument();
				expect(screen.getByText('0/10')).toBeInTheDocument(); // Tool calls progress
			});
		});

		it('renders tool call event correctly', async () => {
			render(<StreamingChat {...defaultProps} />);

			const textarea = screen.getByPlaceholderText(/Ask simplifier agent about test-repo/);
			fireEvent.change(textarea, { target: { value: 'Test query' } });

			const startButton = screen.getByText('Start Streaming');
			fireEvent.click(startButton);

			// Simulate tool call event
			act(() => {
				const toolCallEvent = new MessageEvent('message', {
					data: JSON.stringify({
						id: '2',
						event: 'toolCall',
						data: {
							tool_name: 'search_code',
							arguments: { query: 'test', repo_name: 'test-repo' },
							budget_status: {
								tool_calls_made: 1,
								max_tool_calls: 10,
								elapsed_time: 5,
								time_budget_s: 120,
								convergence_detected: false,
								confidence_avg: 0.8
							}
						},
						timestamp: new Date().toISOString()
					})
				});

				if (mockEventSource.onmessage) {
					mockEventSource.onmessage(toolCallEvent);
				}
			});

			await waitFor(() => {
				expect(screen.getByText('Tool Call')).toBeInTheDocument();
				expect(screen.getByText('Tool: search_code')).toBeInTheDocument();
				expect(screen.getByText('1/10')).toBeInTheDocument(); // Updated tool calls
			});
		});

		it('renders tool result event correctly', async () => {
			render(<StreamingChat {...defaultProps} />);

			const textarea = screen.getByPlaceholderText(/Ask simplifier agent about test-repo/);
			fireEvent.change(textarea, { target: { value: 'Test query' } });

			const startButton = screen.getByText('Start Streaming');
			fireEvent.click(startButton);

			// Simulate tool result event
			act(() => {
				const toolResultEvent = new MessageEvent('message', {
					data: JSON.stringify({
						id: '3',
						event: 'toolResult',
						data: {
							result: 'Found 5 code matches',
							budget_status: {
								tool_calls_made: 1,
								max_tool_calls: 10,
								elapsed_time: 8,
								time_budget_s: 120,
								convergence_detected: false,
								confidence_avg: 0.8
							}
						},
						timestamp: new Date().toISOString()
					})
				});

				if (mockEventSource.onmessage) {
					mockEventSource.onmessage(toolResultEvent);
				}
			});

			await waitFor(() => {
				expect(screen.getByText('Tool Result')).toBeInTheDocument();
				expect(screen.getByText('Result:')).toBeInTheDocument();
				expect(screen.getByText('Found 5 code matches')).toBeInTheDocument();
			});
		});

		it('renders text streaming correctly', async () => {
			render(<StreamingChat {...defaultProps} />);

			const textarea = screen.getByPlaceholderText(/Ask simplifier agent about test-repo/);
			fireEvent.change(textarea, { target: { value: 'Test query' } });

			const startButton = screen.getByText('Start Streaming');
			fireEvent.click(startButton);

			// Simulate text streaming events
			act(() => {
				const textEvent1 = new MessageEvent('message', {
					data: JSON.stringify({
						id: '4',
						event: 'text',
						data: { content: 'Hello, ' },
						timestamp: new Date().toISOString()
					})
				});

				if (mockEventSource.onmessage) {
					mockEventSource.onmessage(textEvent1);
				}
			});

			act(() => {
				const textEvent2 = new MessageEvent('message', {
					data: JSON.stringify({
						id: '5',
						event: 'text',
						data: { content: 'this is a streaming response.' },
						timestamp: new Date().toISOString()
					})
				});

				if (mockEventSource.onmessage) {
					mockEventSource.onmessage(textEvent2);
				}
			});

			await waitFor(() => {
				expect(screen.getByText('Hello, this is a streaming response.')).toBeInTheDocument();
			});
		});

		it('renders budget exceeded event correctly', async () => {
			render(<StreamingChat {...defaultProps} />);

			const textarea = screen.getByPlaceholderText(/Ask simplifier agent about test-repo/);
			fireEvent.change(textarea, { target: { value: 'Test query' } });

			const startButton = screen.getByText('Start Streaming');
			fireEvent.click(startButton);

			// Simulate budget exceeded event
			act(() => {
				const budgetExceededEvent = new MessageEvent('message', {
					data: JSON.stringify({
						id: '6',
						event: 'budget_exceeded',
						data: {
							reason: 'max_tool_calls',
							budget_status: {
								tool_calls_made: 10,
								max_tool_calls: 10,
								elapsed_time: 60,
								time_budget_s: 120,
								convergence_detected: false,
								confidence_avg: 0.7
							}
						},
						timestamp: new Date().toISOString()
					})
				});

				if (mockEventSource.onmessage) {
					mockEventSource.onmessage(budgetExceededEvent);
				}
			});

			await waitFor(() => {
				expect(screen.getByText('Budget Exceeded')).toBeInTheDocument();
				expect(screen.getByText('10/10')).toBeInTheDocument(); // Max tool calls reached
			});
		});

		it('renders convergence event correctly', async () => {
			render(<StreamingChat {...defaultProps} />);

			const textarea = screen.getByPlaceholderText(/Ask simplifier agent about test-repo/);
			fireEvent.change(textarea, { target: { value: 'Test query' } });

			const startButton = screen.getByText('Start Streaming');
			fireEvent.click(startButton);

			// Simulate convergence event
			act(() => {
				const convergenceEvent = new MessageEvent('message', {
					data: JSON.stringify({
						id: '7',
						event: 'converged',
						data: {
							similarity_score: 0.85,
							budget_status: {
								tool_calls_made: 5,
								max_tool_calls: 10,
								elapsed_time: 30,
								time_budget_s: 120,
								convergence_detected: true,
								confidence_avg: 0.9
							}
						},
						timestamp: new Date().toISOString()
					})
				});

				if (mockEventSource.onmessage) {
					mockEventSource.onmessage(convergenceEvent);
				}
			});

			await waitFor(() => {
				expect(screen.getByText('Converged')).toBeInTheDocument();
				expect(screen.getByText('Convergence Detected')).toBeInTheDocument();
			});
		});

		it('renders error event correctly', async () => {
			render(<StreamingChat {...defaultProps} />);

			const textarea = screen.getByPlaceholderText(/Ask simplifier agent about test-repo/);
			fireEvent.change(textarea, { target: { value: 'Test query' } });

			const startButton = screen.getByText('Start Streaming');
			fireEvent.click(startButton);

			// Simulate error event
			act(() => {
				const errorEvent = new MessageEvent('message', {
					data: JSON.stringify({
						id: '8',
						event: 'error',
						data: {
							error: 'Tool execution failed'
						},
						timestamp: new Date().toISOString()
					})
				});

				if (mockEventSource.onmessage) {
					mockEventSource.onmessage(errorEvent);
				}
			});

			await waitFor(() => {
				expect(screen.getByText('Error')).toBeInTheDocument();
				expect(screen.getByText('Tool execution failed')).toBeInTheDocument();
			});
		});

		it('renders done event and stops streaming', async () => {
			const onStreamComplete = jest.fn();
			render(<StreamingChat {...defaultProps} onStreamComplete={onStreamComplete} />);

			const textarea = screen.getByPlaceholderText(/Ask simplifier agent about test-repo/);
			fireEvent.change(textarea, { target: { value: 'Test query' } });

			const startButton = screen.getByText('Start Streaming');
			fireEvent.click(startButton);

			// Simulate done event
			act(() => {
				const doneEvent = new MessageEvent('message', {
					data: JSON.stringify({
						id: '9',
						event: 'done',
						data: {
							final_result: 'Analysis complete',
							total_duration: 45000
						},
						timestamp: new Date().toISOString()
					})
				});

				if (mockEventSource.onmessage) {
					mockEventSource.onmessage(doneEvent);
				}
			});

			await waitFor(() => {
				expect(screen.getByText('Complete')).toBeInTheDocument();
				expect(screen.getByText('Start Streaming')).toBeInTheDocument(); // Back to start button
				expect(onStreamComplete).toHaveBeenCalledWith({
					final_result: 'Analysis complete',
					total_duration: 45000
				});
			});
		});
	});

	describe('User Interactions', () => {
		let mockEventSource: MockEventSource;

		beforeEach(() => {
			mockEventSource = new MockEventSource('test-url');
			jest.spyOn(global, 'EventSource').mockImplementation(() => mockEventSource);
		});

		it('shows stop button during streaming', async () => {
			render(<StreamingChat {...defaultProps} />);

			const textarea = screen.getByPlaceholderText(/Ask simplifier agent about test-repo/);
			fireEvent.change(textarea, { target: { value: 'Test query' } });

			const startButton = screen.getByText('Start Streaming');
			fireEvent.click(startButton);

			await waitFor(() => {
				expect(screen.getByText('Stop')).toBeInTheDocument();
				expect(screen.queryByText('Start Streaming')).not.toBeInTheDocument();
			});
		});

		it('stops streaming when stop button is clicked', async () => {
			render(<StreamingChat {...defaultProps} />);

			const textarea = screen.getByPlaceholderText(/Ask simplifier agent about test-repo/);
			fireEvent.change(textarea, { target: { value: 'Test query' } });

			const startButton = screen.getByText('Start Streaming');
			fireEvent.click(startButton);

			const stopButton = await screen.findByText('Stop');
			fireEvent.click(stopButton);

			await waitFor(() => {
				expect(screen.getByText('Start Streaming')).toBeInTheDocument();
				expect(screen.queryByText('Stop')).not.toBeInTheDocument();
			});
		});

		it('disables textarea during streaming', async () => {
			render(<StreamingChat {...defaultProps} />);

			const textarea = screen.getByPlaceholderText(/Ask simplifier agent about test-repo/) as HTMLTextAreaElement;
			fireEvent.change(textarea, { target: { value: 'Test query' } });

			const startButton = screen.getByText('Start Streaming');
			fireEvent.click(startButton);

			await waitFor(() => {
				expect(textarea).toBeDisabled();
			});
		});
	});

	describe('Error Handling', () => {
		let mockEventSource: MockEventSource;

		beforeEach(() => {
			mockEventSource = new MockEventSource('test-url');
			jest.spyOn(global, 'EventSource').mockImplementation(() => mockEventSource);
		});

		it('handles EventSource errors gracefully', async () => {
			const onError = jest.fn();
			render(<StreamingChat {...defaultProps} onError={onError} />);

			const textarea = screen.getByPlaceholderText(/Ask simplifier agent about test-repo/);
			fireEvent.change(textarea, { target: { value: 'Test query' } });

			const startButton = screen.getByText('Start Streaming');
			fireEvent.click(startButton);

			// Simulate EventSource error
			act(() => {
				if (mockEventSource.onerror) {
					mockEventSource.onerror(new Event('error'));
				}
			});

			await waitFor(() => {
				expect(screen.getByText('Streaming connection failed')).toBeInTheDocument();
				expect(screen.getByText('Start Streaming')).toBeInTheDocument(); // Back to start state
			});
		});

		it('handles malformed JSON events gracefully', async () => {
			render(<StreamingChat {...defaultProps} />);

			const textarea = screen.getByPlaceholderText(/Ask simplifier agent about test-repo/);
			fireEvent.change(textarea, { target: { value: 'Test query' } });

			const startButton = screen.getByText('Start Streaming');
			fireEvent.click(startButton);

			// Simulate malformed JSON event
			act(() => {
				const malformedEvent = new MessageEvent('message', {
					data: 'invalid json'
				});

				if (mockEventSource.onmessage) {
					mockEventSource.onmessage(malformedEvent);
				}
			});

			// Should not crash - component should continue working
			await waitFor(() => {
				expect(screen.getByText('Stop')).toBeInTheDocument();
			});
		});
	});

	describe('Accessibility', () => {
		it('has proper ARIA labels and roles', () => {
			render(<StreamingChat {...defaultProps} />);

			const textarea = screen.getByPlaceholderText(/Ask simplifier agent about test-repo/);
			expect(textarea).toHaveAttribute('role', 'textbox');

			const startButton = screen.getByText('Start Streaming');
			expect(startButton).toHaveAttribute('type', 'button');
		});

		it('maintains focus management during state changes', async () => {
			render(<StreamingChat {...defaultProps} />);

			const textarea = screen.getByPlaceholderText(/Ask simplifier agent about test-repo/);
			fireEvent.change(textarea, { target: { value: 'Test query' } });

			const startButton = screen.getByText('Start Streaming');
			startButton.focus();
			expect(startButton).toHaveFocus();

			fireEvent.click(startButton);

			// Focus should move to stop button
			await waitFor(() => {
				const stopButton = screen.getByText('Stop');
				expect(stopButton).toBeInTheDocument();
			});
		});
	});
}); 
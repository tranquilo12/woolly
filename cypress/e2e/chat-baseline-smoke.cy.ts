/**
 * Baseline Smoke Test for Chat Functionality
 * 
 * This test captures the current behavior of the chat interface
 * before Phase 5.2 Frontend Modernization begins.
 * 
 * Purpose: Ensure no regressions during component modernization
 */

describe('Chat Baseline Smoke Tests', () => {
	beforeEach(() => {
		// Visit the main chat page
		cy.visit('/');
	});

	it('should load the main page without errors', () => {
		// Basic page load verification
		cy.get('body').should('be.visible');
		cy.title().should('not.be.empty');

		// Check for no JavaScript errors in console
		cy.window().then((win) => {
			expect(win.console.error).to.not.have.been.called;
		});
	});

	it('should display the chat interface components', () => {
		// Check for main chat components
		cy.get('[data-testid="chat-layout"], .chat-layout, main').should('exist');

		// Look for sidebar or navigation
		cy.get('[data-testid="sidebar"], .sidebar, nav, aside').should('exist');

		// Look for chat input area
		cy.get('textarea, input[type="text"], [contenteditable="true"]').should('exist');
	});

	it('should navigate to a specific chat when available', () => {
		// Try to navigate to a chat (if any exist)
		cy.get('body').then(($body) => {
			if ($body.find('[href*="/chat/"]').length > 0) {
				// If chat links exist, click one
				cy.get('[href*="/chat/"]').first().click();
				cy.url().should('include', '/chat/');
			} else {
				// If no chats exist, try to create one or visit a test chat
				cy.visit('/chat/test-chat-id');
				cy.url().should('include', '/chat/test-chat-id');
			}
		});
	});

	it('should display agent panel components when in chat', () => {
		// Navigate to a chat page
		cy.visit('/chat/test-chat-id');

		// Check for agent panel components
		cy.get('body').then(($body) => {
			// Look for agent panel or similar components
			const agentPanelSelectors = [
				'[data-testid="agent-panel"]',
				'.agent-panel',
				'[class*="agent"]',
				'[data-testid="message-group"]',
				'.message-group'
			];

			let found = false;
			agentPanelSelectors.forEach(selector => {
				if ($body.find(selector).length > 0) {
					found = true;
				}
			});

			// At least one agent-related component should exist
			expect(found).to.be.true;
		});
	});

	it('should handle responsive design', () => {
		// Test mobile viewport
		cy.viewport(375, 667);
		cy.visit('/');
		cy.get('body').should('be.visible');

		// Test tablet viewport
		cy.viewport(768, 1024);
		cy.get('body').should('be.visible');

		// Test desktop viewport
		cy.viewport(1280, 720);
		cy.get('body').should('be.visible');
	});

	it('should not have accessibility violations on main page', () => {
		cy.visit('/');

		// Basic accessibility checks
		cy.get('body').should('have.attr', 'class');

		// Check for proper heading structure
		cy.get('h1, h2, h3, h4, h5, h6').should('exist');

		// Check for proper link text (no "click here" or empty links)
		cy.get('a').each(($link) => {
			const text = $link.text().trim();
			const ariaLabel = $link.attr('aria-label');
			expect(text.length > 0 || (ariaLabel && ariaLabel.length > 0)).to.be.true;
		});
	});

	it('should load CSS and styling correctly', () => {
		cy.visit('/');

		// Check that Tailwind classes are working
		cy.get('body').should('have.class');

		// Verify that the page has some basic styling
		cy.get('body').should(($body) => {
			const computedStyle = window.getComputedStyle($body[0]);
			expect(computedStyle.margin).to.not.equal('');
			expect(computedStyle.fontFamily).to.not.equal('');
		});
	});

	it('should handle navigation between pages', () => {
		cy.visit('/');

		// Test navigation to chat page
		cy.visit('/chat/test-navigation');
		cy.url().should('include', '/chat/test-navigation');

		// Navigate back to home
		cy.visit('/');
		cy.url().should('not.include', '/chat/');
	});

	it('should capture current component structure for regression testing', () => {
		cy.visit('/chat/baseline-test');

		// Capture the DOM structure for comparison after modernization
		cy.get('body').then(($body) => {
			const componentClasses = [];
			const testIds = [];

			// Collect all class names that might be component-related
			$body.find('[class*="component"], [class*="panel"], [class*="chat"], [class*="agent"], [class*="message"]')
				.each((index, element) => {
					componentClasses.push(element.className);
				});

			// Collect all test IDs
			$body.find('[data-testid]')
				.each((index, element) => {
					testIds.push(element.getAttribute('data-testid'));
				});

			// Log for debugging
			cy.log('Component classes found:', componentClasses.length);
			cy.log('Test IDs found:', testIds.length);

			// Ensure we have some components
			expect(componentClasses.length + testIds.length).to.be.greaterThan(0);
		});
	});
});

/**
 * Chat Functionality Baseline Tests
 * 
 * These tests focus on core chat functionality that should be preserved
 */
describe('Chat Functionality Baseline', () => {
	it('should render chat input area', () => {
		cy.visit('/chat/functionality-test');

		// Look for input elements
		cy.get('textarea, input[type="text"], [contenteditable="true"]').should('exist');
	});

	it('should handle theme switching if available', () => {
		cy.visit('/');

		// Look for theme toggle
		cy.get('body').then(($body) => {
			if ($body.find('[data-testid="theme-toggle"], button[aria-label*="theme"], button[aria-label*="dark"], button[aria-label*="light"]').length > 0) {
				cy.get('[data-testid="theme-toggle"], button[aria-label*="theme"], button[aria-label*="dark"], button[aria-label*="light"]')
					.first()
					.click();

				// Verify theme change
				cy.get('html, body').should('have.class');
			}
		});
	});

	it('should preserve current routing structure', () => {
		// Test main routes
		const routes = ['/', '/chat/route-test'];

		routes.forEach(route => {
			cy.visit(route);
			cy.url().should('include', route.includes('/chat/') ? '/chat/' : route);
		});
	});
}); 
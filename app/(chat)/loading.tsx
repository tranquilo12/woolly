export default function Loading() {
	return (
		<div className="flex flex-col w-full h-[calc(100vh-4rem)] max-w-4xl mx-auto">
			<div className="flex-1 overflow-y-auto px-4 pb-36">
				<div className="flex flex-col w-full gap-4 py-4">
					{/* Simulate multiple message skeletons */}
					{[...Array(3)].map((_, i) => (
						<div
							key={i}
							className={`p-4 rounded-lg max-w-[80%] ${i % 2 === 0 ? "ml-auto" : "mr-auto"
								}`}
						>
							<div className="animate-pulse">
								<div className="h-4 bg-primary/10 rounded w-3/4 mb-2"></div>
								<div className="h-4 bg-primary/10 rounded w-1/2"></div>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Simulate input skeleton */}
			<div className="border-t fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm">
				<div className="max-w-4xl mx-auto p-4">
					<div className="animate-pulse">
						<div className="h-10 bg-primary/10 rounded"></div>
					</div>
				</div>
			</div>
		</div>
	);
} 
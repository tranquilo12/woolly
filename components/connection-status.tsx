import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export function ConnectionStatus() {
	const [status, setStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
	const [lastChecked, setLastChecked] = useState<Date | null>(null);

	const checkConnection = async () => {
		try {
			setStatus('checking');
			const response = await fetch(`${BACKEND_URL}/api/health`);
			if (response.ok) {
				setStatus('connected');
			} else {
				setStatus('disconnected');
			}
		} catch (error) {
			setStatus('disconnected');
		}
		setLastChecked(new Date());
	};

	useEffect(() => {
		checkConnection();
		const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
		return () => clearInterval(interval);
	}, []);

	const getStatusColor = () => {
		switch (status) {
			case 'connected': return 'bg-green-500';
			case 'disconnected': return 'bg-red-500';
			case 'checking': return 'bg-yellow-500';
			default: return 'bg-gray-500';
		}
	};

	const getStatusText = () => {
		switch (status) {
			case 'connected': return 'Connected';
			case 'disconnected': return 'Disconnected';
			case 'checking': return 'Checking...';
			default: return 'Unknown';
		}
	};

	return (
		<div className="flex items-center gap-2 text-sm text-muted-foreground">
			<Badge variant="outline" className={`${getStatusColor()} text-white border-0`}>
				{getStatusText()}
			</Badge>
			{lastChecked && (
				<span className="text-xs">
					Last checked: {lastChecked.toLocaleTimeString()}
				</span>
			)}
		</div>
	);
} 
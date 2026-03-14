/**
 * Lightweight structured event collector for pipeline runs.
 *
 * Accumulates events in memory during a run, then returns the full array
 * plus a derived status ('success' | 'partial' | 'failed') when finalized.
 *
 * Every event is also mirrored to the console so wrangler tail / local dev
 * still works exactly as before.
 */
export function createPipelineLog() {
	const events = [];
	const start = Date.now();

	function push(step, level, message, meta) {
		events.push({ step, level, message, meta, at: new Date().toISOString() });

		const prefix = `[${step.toUpperCase()}]`;
		if (level === 'error') console.error(`${prefix} ${message}`);
		else if (level === 'warn') console.warn(`${prefix} ${message}`);
		else console.log(`${prefix} ${message}`);
	}

	return {
		info:  (step, message, meta) => push(step, 'info',  message, meta),
		warn:  (step, message, meta) => push(step, 'warn',  message, meta),
		error: (step, message, meta) => push(step, 'error', message, meta),

		/**
		 * Call at the end of the run to get the payload for saveRun.
		 * @returns {{ status: 'success'|'partial'|'failed', events: object[], duration_ms: number }}
		 */
		finalize() {
			const hasError = events.some((e) => e.level === 'error');
			const hasWarn = events.some((e) => e.level === 'warn');
			return {
				status: hasError ? 'failed' : hasWarn ? 'partial' : 'success',
				events,
				duration_ms: Date.now() - start,
			};
		},
	};
}

import tracer from 'dd-trace';

// Skip initialization during Next.js build
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

if (typeof window === 'undefined' && !isBuildTime) {
    console.log('[Datadog] Skipping APM tracer initialization (not supported without agent)');
    console.log('[Datadog] Using metrics-only mode');
}

export default tracer;

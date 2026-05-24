import { anyApi, cronJobs } from 'convex/server'

const crons = cronJobs()

crons.interval('weekly repo health scan', { hours: 24 * 7 }, anyApi.scans.runScheduledScan)

export default crons

// Vercel's build step for this project — generates the Prisma client every time (its
// postinstall hook doesn't reliably run again once Vercel caches dependencies), then
// only actually migrates the shared Aiven database on a real production deploy. Preview
// deployments (PRs, branches) point at the same DATABASE_URL today — there's no second
// database yet — so running migrate deploy there too would let an unmerged, maybe-wrong
// migration touch the live schema the moment its preview builds.
const { execSync } = require('child_process');

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

run('npx prisma generate');

if (process.env.VERCEL_ENV === 'production') {
  run('npx prisma migrate deploy');
} else {
  console.log(`Skipping "prisma migrate deploy" — VERCEL_ENV is "${process.env.VERCEL_ENV || 'undefined'}", not "production".`);
}

run('npx tsc');

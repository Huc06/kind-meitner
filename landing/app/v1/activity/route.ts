import { getActivity, REVALIDATE_SECONDS } from "@nymspace/github";

export const revalidate = 60;

export async function GET() {
  const activity = await getActivity();
  return Response.json(activity, {
    headers: { "Cache-Control": `s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=${REVALIDATE_SECONDS}` },
  });
}

import { apiResponse, preflight } from "../../../../lib/api";
import { verifyFirebaseToken } from "../../../../lib/firebaseAuth";
import { verifyTranslationAccess } from "../../../../lib/translationAccess";
import { openAIModels } from "../../../../lib/openaiModels";

export async function GET(request: Request): Promise<Response> {
  return apiResponse(request, async (headers) => {
    const identity = await verifyFirebaseToken(request);
    await verifyTranslationAccess(request, identity);
    return Response.json({
      configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      models: await openAIModels(),
    }, { headers });
  });
}
export function OPTIONS(request: Request) {
  return preflight(request, "GET", ["X-Firebase-AppCheck"]);
}

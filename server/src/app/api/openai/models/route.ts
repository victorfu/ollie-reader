import { apiResponse, getOptions } from "../../../../lib/api";
import { verifyFirebaseToken } from "../../../../lib/firebaseAuth";
import { openAIModels } from "../../../../lib/openaiTranslation";

export async function GET(request: Request): Promise<Response> {
  return apiResponse(request, async (headers) => {
    await verifyFirebaseToken(request);
    return Response.json({
      configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      models: openAIModels(),
    }, { headers });
  });
}
export const OPTIONS = getOptions;

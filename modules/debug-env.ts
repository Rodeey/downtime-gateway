import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export default async function handler(request: ZuploRequest, context: ZuploContext) {
  return new Response(JSON.stringify({
    ALL_ENV: Object.keys(process.env)
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

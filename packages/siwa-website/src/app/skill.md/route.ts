import { readFileSync } from "fs";
import { resolve } from "path";

export async function GET() {
  const skillPath = resolve(
    process.cwd(),
    "..",
    "siwa-skill",
    "skill.md"
  );

  try {
    const content = readFileSync(skillPath, "utf-8");
    return new Response(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("# skill.md not found\n\nPlease check the deployment configuration.", {
      status: 404,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }
}

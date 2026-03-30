import { Hono } from "hono";
import type { AppEnv } from "../app.js";

const ontology = new Hono<AppEnv>();

// GET /api/v1/ontology/concepts — list concepts
ontology.get("/concepts", async (c) => {
  const ontologyService = c.get("ontologyService");
  const workspaceId = c.get("workspaceId");

  const concepts = await ontologyService.getConcepts(workspaceId);

  return c.json({ data: concepts });
});

// GET /api/v1/ontology/graph — get full graph (relations with concepts)
ontology.get("/graph", async (c) => {
  const ontologyService = c.get("ontologyService");
  const workspaceId = c.get("workspaceId");

  const graph = await ontologyService.getRelations(workspaceId);

  return c.json({ data: graph });
});

// POST /api/v1/ontology/rebuild — trigger rebuild
ontology.post("/rebuild", async (c) => {
  const ontologyService = c.get("ontologyService");
  const workspaceId = c.get("workspaceId");

  await ontologyService.rebuildForWorkspace(workspaceId);

  return c.json({
    data: {
      status: "rebuilding",
      message: "Ontology rebuild triggered",
    },
  });
});

export default ontology;

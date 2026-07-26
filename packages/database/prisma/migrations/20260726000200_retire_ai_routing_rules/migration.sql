-- AiRoutingRule was never part of the execution resolver. MODEL_CONFIG is the
-- sole operational routing source. Preserve legacy rows for audit/rollback
-- instead of dropping potentially useful administrative history.
ALTER TABLE "AiRoutingRule" RENAME TO "AiRoutingRuleLegacy";

-- Rollback (manual, before deploying code that still queries the legacy API):
-- ALTER TABLE "AiRoutingRuleLegacy" RENAME TO "AiRoutingRule";

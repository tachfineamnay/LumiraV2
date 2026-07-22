-- Activate every Lumira OpenAI agent without replacing the founder's prompts,
-- pinned models, temperatures, reasoning settings, or token budgets.
DO $$
DECLARE
  active_config RECORD;
  parsed_config JSONB;
BEGIN
  FOR active_config IN
    SELECT "id", "value"
    FROM "PromptVersion"
    WHERE "key" = 'MODEL_CONFIG'
      AND "isActive" = true
  LOOP
    BEGIN
      parsed_config := active_config."value"::jsonb;
      parsed_config := jsonb_set(parsed_config, '{agents,SCRIBE,enabled}', 'true'::jsonb, true);
      parsed_config := jsonb_set(parsed_config, '{agents,EDITOR,enabled}', 'true'::jsonb, true);
      parsed_config := jsonb_set(parsed_config, '{agents,GUIDE,enabled}', 'true'::jsonb, true);
      parsed_config := jsonb_set(parsed_config, '{agents,NARRATOR,enabled}', 'true'::jsonb, true);
      parsed_config := jsonb_set(parsed_config, '{agents,CONFIDANT,enabled}', 'true'::jsonb, true);
      parsed_config := jsonb_set(parsed_config, '{agents,ONIRIQUE,enabled}', 'true'::jsonb, true);

      UPDATE "PromptVersion"
      SET "value" = parsed_config::text
      WHERE "id" = active_config."id";
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE WARNING 'MODEL_CONFIG % is not valid JSON; runtime defaults will be used', active_config."id";
    END;
  END LOOP;
END $$;

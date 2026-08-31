-- WorkspaceSetting.workspaceId was a bare primary key with no foreign key
-- to workspaces(id) at all -- deleting a workspace left its settings row
-- permanently orphaned (nothing to cascade through) and nothing enforced
-- that workspace_id even referenced a real workspace.

-- Clean up any rows that already reference a workspace that no longer
-- exists, so the new constraint can actually be added.
DELETE FROM "workspace_settings" ws
WHERE NOT EXISTS (SELECT 1 FROM "workspaces" w WHERE w.id = ws."workspace_id");

ALTER TABLE "workspace_settings"
  ADD CONSTRAINT "workspace_settings_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

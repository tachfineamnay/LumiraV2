-- Additive extension of the post-delivery amendment workflow.
-- Historical PALM_PHOTO rows and immutable reading snapshots remain untouched.

ALTER TABLE "ReadingIntakeAmendment"
  DROP CONSTRAINT "ReadingIntakeAmendment_kind_check";

ALTER TABLE "ReadingIntakeAmendment"
  ADD CONSTRAINT "ReadingIntakeAmendment_kind_check"
  CHECK ("kind" IN ('PALM_PHOTO', 'PROFILE_FIELDS'));

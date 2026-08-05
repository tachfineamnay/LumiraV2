-- Additive extension for expert-requested completion of required intake fields.
-- Historical PALM_PHOTO rows, sealed ReadingIntake data, snapshots, versions,
-- PDF/audio files and delivery records remain untouched.

ALTER TABLE "ReadingIntakeAmendment"
  DROP CONSTRAINT IF EXISTS "ReadingIntakeAmendment_kind_check";

ALTER TABLE "ReadingIntakeAmendment"
  ADD CONSTRAINT "ReadingIntakeAmendment_kind_check"
  CHECK ("kind" IN ('PALM_PHOTO', 'PROFILE_FIELDS'));

const fs = require('node:fs');
const path = require('node:path');

const prismaDir = __dirname;
const sourcePath = path.join(prismaDir, 'schema.prisma');
const runtimePath = path.join(prismaDir, 'schema.runtime.prisma');
const source = fs.readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n');

function modelBounds(schema, modelName) {
  const marker = `model ${modelName} {`;
  const start = schema.indexOf(marker);
  if (start < 0) throw new Error(`Prisma model not found: ${modelName}`);

  let depth = 0;
  let opened = false;
  for (let index = start; index < schema.length; index += 1) {
    const char = schema[index];
    if (char === '{') {
      depth += 1;
      opened = true;
    } else if (char === '}') {
      depth -= 1;
      if (opened && depth === 0) return { start, end: index + 1 };
    }
  }
  throw new Error(`Unclosed Prisma model: ${modelName}`);
}

function insertModelFields(schema, modelName, guardToken, fields) {
  const bounds = modelBounds(schema, modelName);
  const block = schema.slice(bounds.start, bounds.end);
  if (block.includes(guardToken)) return schema;

  const blockAttributeIndex = block.indexOf('\n  @@');
  const insertionIndex = blockAttributeIndex >= 0 ? blockAttributeIndex + 1 : block.length - 1;
  const prefix = block.slice(0, insertionIndex).trimEnd();
  const suffix = block.slice(insertionIndex).trimStart();
  const extended = `${prefix}\n${fields}\n\n  ${suffix}`.replace(/\n\n  }$/, '\n}');
  return `${schema.slice(0, bounds.start)}${extended}${schema.slice(bounds.end)}`;
}

function extendReadingVersion(schema) {
  const bounds = modelBounds(schema, 'ReadingVersion');
  const block = schema.slice(bounds.start, bounds.end);
  let extended = block;

  if (!extended.includes('inputSnapshotId String?')) {
    const fieldMarker = '  parentVersionId String?\n';
    if (!extended.includes(fieldMarker)) {
      throw new Error('ReadingVersion shape changed; amendment schema extension must be reviewed');
    }
    extended = extended.replace(
      fieldMarker,
      `${fieldMarker}  /// Exact immutable input snapshot used for this generated version.\n  inputSnapshotId String?\n`,
    );
  }

  if (!extended.includes('inputSnapshot ReadingInputSnapshot?')) {
    const indexMarker = '  @@index([contentHash])\n';
    if (!extended.includes(indexMarker)) {
      throw new Error('ReadingVersion indexes changed; amendment schema extension must be reviewed');
    }
    extended = extended.replace(
      indexMarker,
      `  inputSnapshot ReadingInputSnapshot? @relation("ReadingVersionInputSnapshot", fields: [inputSnapshotId], references: [id], onDelete: SetNull)\n\n${indexMarker}`,
    );
  }

  if (!extended.includes('@@index([inputSnapshotId])')) {
    const indexMarker = '  @@index([contentHash])\n';
    extended = extended.replace(indexMarker, `${indexMarker}  @@index([inputSnapshotId])\n`);
  }

  return `${schema.slice(0, bounds.start)}${extended}${schema.slice(bounds.end)}`;
}

const extension = `

// =============================================================================
// READING INTAKE AMENDMENTS — additive SQL migration
// =============================================================================

/// Targeted, audited client complement. Status/kind check constraints and the
/// partial unique active-request index are enforced by PostgreSQL migration.
model ReadingIntakeAmendment {
  id                    String   @id
  orderId               String
  userId                String
  readingIntakeId       String?
  kind                  String
  requestedFields       String[] @default([])
  reason                String   @db.Text
  status                String   @default("REQUESTED")
  data                  Json     @default("{}")
  contentHash           String?
  revision              Int      @default(0)
  requestedByExpertId   String
  reviewedByExpertId    String?
  requestedAt           DateTime @default(now())
  submittedAt           DateTime?
  reviewedAt            DateTime?
  expiresAt             DateTime
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  order             Order          @relation("ReadingIntakeAmendmentOrder", fields: [orderId], references: [id], onDelete: Cascade)
  user              User           @relation("ReadingIntakeAmendmentUser", fields: [userId], references: [id], onDelete: Cascade)
  readingIntake     ReadingIntake? @relation("ReadingIntakeAmendmentBase", fields: [readingIntakeId], references: [id], onDelete: SetNull)
  requestedByExpert Expert         @relation("ReadingIntakeAmendmentRequestedBy", fields: [requestedByExpertId], references: [id], onDelete: Restrict)
  reviewedByExpert  Expert?        @relation("ReadingIntakeAmendmentReviewedBy", fields: [reviewedByExpertId], references: [id], onDelete: SetNull)

  @@index([orderId, status, updatedAt(sort: Desc)])
  @@index([userId, status, updatedAt(sort: Desc)])
  @@index([expiresAt])
  @@index([contentHash])
}

/// Immutable effective input generated by applying approved amendments to the
/// original sealed ReadingIntake.
model ReadingInputSnapshot {
  id               String   @id
  orderId          String
  userId           String
  baseIntakeId     String?
  revision         Int
  parentSnapshotId String?
  data             Json
  contentHash      String
  amendmentIds     String[] @default([])
  createdAt        DateTime @default(now())

  order           Order                 @relation("ReadingInputSnapshotOrder", fields: [orderId], references: [id], onDelete: Cascade)
  user            User                  @relation("ReadingInputSnapshotUser", fields: [userId], references: [id], onDelete: Cascade)
  baseIntake      ReadingIntake?        @relation("ReadingInputSnapshotBase", fields: [baseIntakeId], references: [id], onDelete: SetNull)
  parentSnapshot  ReadingInputSnapshot? @relation("ReadingInputSnapshotLineage", fields: [parentSnapshotId], references: [id], onDelete: SetNull)
  childSnapshots  ReadingInputSnapshot[] @relation("ReadingInputSnapshotLineage")
  readingVersions ReadingVersion[]       @relation("ReadingVersionInputSnapshot")

  @@unique([orderId, revision])
  @@unique([orderId, contentHash])
  @@index([userId, createdAt(sort: Desc)])
}
`;

let runtime = extendReadingVersion(source);
runtime = insertModelFields(
  runtime,
  'Order',
  'readingIntakeAmendments ReadingIntakeAmendment[]',
  '  readingIntakeAmendments ReadingIntakeAmendment[] @relation("ReadingIntakeAmendmentOrder")\n  readingInputSnapshots    ReadingInputSnapshot[]    @relation("ReadingInputSnapshotOrder")',
);
runtime = insertModelFields(
  runtime,
  'User',
  'readingIntakeAmendments ReadingIntakeAmendment[]',
  '  readingIntakeAmendments ReadingIntakeAmendment[] @relation("ReadingIntakeAmendmentUser")\n  readingInputSnapshots    ReadingInputSnapshot[]    @relation("ReadingInputSnapshotUser")',
);
runtime = insertModelFields(
  runtime,
  'Expert',
  'requestedReadingIntakeAmendments',
  '  requestedReadingIntakeAmendments ReadingIntakeAmendment[] @relation("ReadingIntakeAmendmentRequestedBy")\n  reviewedReadingIntakeAmendments  ReadingIntakeAmendment[] @relation("ReadingIntakeAmendmentReviewedBy")',
);
runtime = insertModelFields(
  runtime,
  'ReadingIntake',
  'readingIntakeAmendments ReadingIntakeAmendment[]',
  '  readingIntakeAmendments ReadingIntakeAmendment[] @relation("ReadingIntakeAmendmentBase")\n  inputSnapshots          ReadingInputSnapshot[]    @relation("ReadingInputSnapshotBase")',
);
runtime = runtime.trimEnd();
if (!runtime.includes('model ReadingIntakeAmendment {')) runtime += extension;
runtime += '\n';
fs.writeFileSync(runtimePath, runtime, 'utf8');
console.log(`Generated ${path.relative(process.cwd(), runtimePath)}`);

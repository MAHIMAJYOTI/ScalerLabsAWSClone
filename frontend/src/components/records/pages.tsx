"use client";

import { ImportZoneFile } from "./ImportZoneFile";
import { RecordForm } from "./RecordForm";
import { RecordPageLoader, ZonePageLoader } from "./ZonePageLoader";

export function CreateRecordPage({ zoneId }: { zoneId: string }) {
  return (
    <ZonePageLoader zoneId={zoneId} title="Create record">
      {(zone) => <RecordForm zone={zone} mode="create" />}
    </ZonePageLoader>
  );
}

export function EditRecordPage({
  zoneId,
  recordId,
}: {
  zoneId: string;
  recordId: string;
}) {
  return (
    <RecordPageLoader zoneId={zoneId} recordId={recordId} title="Edit record">
      {(zone, record) => <RecordForm zone={zone} mode="edit" record={record} />}
    </RecordPageLoader>
  );
}

export function ImportZonePage({ zoneId }: { zoneId: string }) {
  return (
    <ZonePageLoader zoneId={zoneId} title="Import zone file">
      {(zone) => <ImportZoneFile zone={zone} />}
    </ZonePageLoader>
  );
}

'use client';
import { archiveItem } from '@/app/admin/actions';
import { MutationButton } from './mutation-button';
export function ArchiveButton({ kind, id }: { kind: 'TECHNICIAN' | 'SERVICE'; id: string }) {
  return (
    <MutationButton
      action={() => archiveItem(kind, id)}
      label="ปิดใช้งานรายการ"
      confirm="ปิดรายการนี้จากหน้าค้นหา? ประวัติการจองเดิมจะยังคงอยู่"
      danger
    />
  );
}

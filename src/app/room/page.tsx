'use client';

import { Suspense } from 'react';
import { RoomContent } from '@/components/room/RoomContent';

export default function RoomPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c0b0b', color: '#5a5552', fontSize: 13 }}>
        Loading…
      </div>
    }>
      <RoomContent />
    </Suspense>
  );
}

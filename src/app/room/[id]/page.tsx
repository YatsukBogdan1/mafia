import { Suspense } from 'react';
import { RoomContent } from '@/components/room/RoomContent';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RoomPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c0b0b', color: '#5a5552', fontSize: 13 }}>
        Loading…
      </div>
    }>
      <RoomContent roomId={id.toUpperCase()} />
    </Suspense>
  );
}

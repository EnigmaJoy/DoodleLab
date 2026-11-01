// app/lavagna/[id]/page.tsx
export default function NotaPage({ params }: { params: { id: string } }) {
  return <div style={{ color: '#fff', padding: '2rem' }}>Nota: {params.id}</div>
}

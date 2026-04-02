import ReviewSession from './ReviewSession'

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookId: string; moduleId: string }>
  searchParams: Promise<{ scheduleId?: string }>
}) {
  const { bookId, moduleId } = await params
  const { scheduleId } = await searchParams

  if (!scheduleId) {
    return <div className="p-10 text-center text-gray-500">缺少 scheduleId 参数</div>
  }

  return (
    <ReviewSession
      bookId={Number(bookId)}
      moduleId={Number(moduleId)}
      scheduleId={Number(scheduleId)}
    />
  )
}

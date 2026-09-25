import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  const [notifications, total] = await Promise.all([
    prisma.inAppNotification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.inAppNotification.count({
      where: { userId: session.user.id },
    }),
  ]);

  // Map to the format expected by the mobile activity feed
  const items = notifications.map((n) => ({
    id: n.id,
    type: n.bountyId ? 'bounty_created' : n.applicationId ? 'bounty_applied' : 'message_received',
    title: n.title,
    body: n.body,
    read: n.read,
    bountyId: n.bountyId ?? undefined,
    applicationId: n.applicationId ?? undefined,
    createdAt: n.createdAt.toISOString(),
  }));

  return NextResponse.json({
    success: true,
    data: {
      items,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total,
        hasMore: offset + limit < total,
      },
    },
    notifications: items,
    total,
    limit,
    offset,
  });
}

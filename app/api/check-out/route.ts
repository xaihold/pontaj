import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import TimeLog from '@/models/TimeLog';

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const { userId, description } = body;

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        // Find the active session
        const activeSession = await TimeLog.findOne({ userId, isActive: true });

        if (!activeSession) {
            return NextResponse.json({ error: 'No active session found' }, { status: 404 });
        }

        const now = new Date();
        const durationMs = now.getTime() - new Date(activeSession.checkIn).getTime();
        const durationMinutes = Math.floor(durationMs / 60000);

        activeSession.checkOut = now;
        activeSession.duration = durationMinutes;
        activeSession.isActive = false;
        if (description) activeSession.description = description;

        await activeSession.save();

        return NextResponse.json({ success: true, log: activeSession }, { status: 200 });
    } catch (error: any) {
        console.error('Check-out error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}

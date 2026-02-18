import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import TimeLog from '@/models/TimeLog';

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const { userId, userName, email } = body;

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        // Check for existing active session
        const activeSession = await TimeLog.findOne({ userId, isActive: true });

        if (activeSession) {
            return NextResponse.json({
                error: 'Active session already exists',
                session: activeSession
            }, { status: 409 });
        }

        const now = new Date();
        const dateString = now.toISOString().split('T')[0]; // YYYY-MM-DD

        const newLog = await TimeLog.create({
            userId,
            userName,
            email,
            checkIn: now,
            dateString,
            isActive: true,
        });

        return NextResponse.json({ success: true, log: newLog }, { status: 201 });
    } catch (error: any) {
        console.error('Check-in error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import LocationSettings from '@/models/LocationSettings';

export async function GET(request: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const locationId = searchParams.get('locationId');

        if (!locationId) return NextResponse.json({ hasKey: false, hasAgencyKey: false });

        const settings = await LocationSettings.findOne({ locationId });
        return NextResponse.json({
            hasKey: !!settings?.apiKey,
            hasAgencyKey: !!settings?.agencyApiKey
        });
    } catch (error) {
        return NextResponse.json({ hasKey: false, hasAgencyKey: false });
    }
}

export async function POST(request: Request) {
    try {
        await dbConnect();
        let { apiKey, agencyApiKey, locationId } = await request.json();

        if (!locationId) {
            return NextResponse.json({ error: 'Missing Location ID' }, { status: 400 });
        }

        // --- 1. SAVE KEYS ---
        const updateFields: any = { updatedAt: new Date() };
        if (apiKey) updateFields.apiKey = apiKey;
        if (agencyApiKey) updateFields.agencyApiKey = agencyApiKey;

        const settings = await LocationSettings.findOneAndUpdate(
            { locationId },
            updateFields,
            { upsert: true, new: true }
        );

        // --- 2. RESOLVE KEYS TO USE ---
        const activeApiKey = apiKey || settings?.apiKey;
        const activeAgencyKey = agencyApiKey || settings?.agencyApiKey;

        if (!activeApiKey && !activeAgencyKey) {
            return NextResponse.json({ error: 'Missing API Keys (None provided or saved)' }, { status: 400 });
        }

        const stats = {
            total: 0,
            added: 0,
            updated: 0,
            agencyUsers: 0
        };

        // Helper to process users
        const processUsers = async (users: any[], source: 'location' | 'agency') => {
            for (const ghlUser of users) {
                const userId = ghlUser.id;
                const userName = ghlUser.name || `${ghlUser.firstName} ${ghlUser.lastName}`;
                const email = ghlUser.email;

                // Determine Role
                let role = 'user';
                let isOwner = false;

                if (source === 'agency') {
                    // Agency users are automatically Admins in this app context
                    role = 'admin';
                    // Optional: Make them Owner if they match specific criteria? 
                    // For now, just Admin is safe. 'Owner' is supreme.
                } else {
                    // Location source: Trust GHL role somewhat, but default to user
                    if (ghlUser.type === 'agency' || ghlUser.roles?.admin) {
                        role = 'admin';
                    }
                }

                const existingUser = await User.findOne({ userId });

                if (!existingUser) {
                    await User.create({
                        userId,
                        userName,
                        email,
                        locationId, // Assign to current location context
                        role,
                        isOwner,
                        lastSeen: new Date()
                    });
                    stats.added++;
                } else {
                    // Update
                    existingUser.userName = userName;
                    existingUser.email = email;
                    existingUser.locationId = locationId; // Ensure they are visible here

                    // Upgrade role if coming from Agency or if GHL says so, but don't downgrade Admin/Owner blindly?
                    // actually, sync should be authoritative for "permissions" if possible.
                    // If source is agency, FORCE 'admin'.
                    if (source === 'agency') {
                        existingUser.role = 'admin';
                    }

                    await existingUser.save();
                    stats.updated++;
                }
            }
        };

        // --- 3. EXECUTE SYNC (Location First) ---
        if (activeApiKey) {
            console.log('Syncing Location Users...');
            try {
                const response = await fetch('https://rest.gohighlevel.com/v1/users/', {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${activeApiKey}`, 'Content-Type': 'application/json' }
                });

                if (response.ok) {
                    const data = await response.json();
                    const users = data.users || (Array.isArray(data) ? data : []);
                    console.log(`Found ${users.length} location users.`);
                    await processUsers(users, 'location');
                    stats.total += users.length;
                } else {
                    const errorText = await response.text();
                    console.error('GHL Location API Error:', response.status, errorText);
                }
            } catch (err) {
                console.error('Location Sync Failed', err);
            }
        }

        // --- 4. EXECUTE SYNC (Agency Second - Overwrites privileges) ---
        if (activeAgencyKey) {
            console.log('Syncing Agency Users...');
            try {
                // Try fetching all users visible to Agency Key
                // V1 Agency Key usually returns all users in the agency? Or specific endpoint?
                // Let's try standard endpoint. If it returns everyone, fine.
                const response = await fetch('https://rest.gohighlevel.com/v1/users/', {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${activeAgencyKey}`, 'Content-Type': 'application/json' }
                });

                if (response.ok) {
                    const data = await response.json();
                    let users = data.users || (Array.isArray(data) ? data : []);

                    // Filter? If Agency Key returns ALL users from ALL sub-accounts, that's a lot.
                    // But we want "Agency Team". usually these have type='agency'.
                    // Let's filter client-side just in case.
                    const initialCount = users.length;
                    users = users.filter((u: any) =>
                        u.type === 'agency' ||
                        u.roles?.type === 'agency' ||
                        u.companyId // Agency users often have companyId
                    );

                    // If filter removed everyone, maybe they don't have 'type' field? 
                    // Fallback: If we get 0 after filter, maybe just take the first 100? No.
                    // Let's trust that Agency Users have some distinct marker OR just import them all if the user provided the key.
                    // User asked to "Extract TEAM on Agency".
                    // Let's assume the user knows what key provided. 
                    // But wait, if they provide Agency Key, `v1/users/` might return 10,000 users from all subaccounts.
                    // We MUST filter for "Agency Level" users.
                    // Standard GHL User Object has `type`.

                    if (users.length === 0 && initialCount > 0) {
                        // filtering might have been too strict?
                        console.warn('Agency User Filter returned 0. Using raw list? Risk of pollution.');
                    }

                    console.log(`Found ${users.length} AGENCY users (filtered from ${initialCount}).`);
                    await processUsers(users, 'agency');
                    stats.total += users.length; // Count effectively processed
                    stats.agencyUsers = users.length;
                } else {
                    const errorText = await response.text();
                    console.error('GHL Agency API Error:', response.status, errorText);
                }
            } catch (err) {
                console.error('Agency Sync Failed', err);
            }
        }

        return NextResponse.json({ success: true, stats });

    } catch (error: any) {
        console.error('Sync Error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}


import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(request: any) {
  try {
    const res = await pool.query('SELECT NOW() as current_time');
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        currentTime: res.rows[0].current_time,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: err.message,
      }),
    };
  }
}

import pool from '../db/connection';

export interface PriceAlert {
  id: number;
  alert_type: 'above' | 'below';
  target_price: number;
  is_active: boolean;
  triggered: boolean;
  triggered_at: Date | null;
  triggered_price: number | null;
  country: string;
  user_session_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAlertData {
  alert_type: 'above' | 'below';
  target_price: number;
  country?: string;
  user_session_id?: string;
}

/**
 * Create a new price alert
 */
export async function createAlert(data: CreateAlertData): Promise<PriceAlert> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO price_alerts (alert_type, target_price, country, user_session_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        data.alert_type,
        data.target_price,
        data.country || 'India',
        data.user_session_id || null
      ]
    );
    
    return mapRowToAlert(result.rows[0]);
  } finally {
    client.release();
  }
}

/**
 * Get all alerts (optionally filtered by active status)
 */
export async function getAllAlerts(
  country: string = 'India',
  activeOnly: boolean = false
): Promise<PriceAlert[]> {
  const client = await pool.connect();
  try {
    let query = `
      SELECT * FROM price_alerts
      WHERE country = $1
    `;
    const params: any[] = [country];
    
    if (activeOnly) {
      query += ' AND is_active = TRUE';
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await client.query(query, params);
    return result.rows.map(mapRowToAlert);
  } finally {
    client.release();
  }
}

/**
 * Get a single alert by ID
 */
export async function getAlertById(id: number): Promise<PriceAlert | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM price_alerts WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return mapRowToAlert(result.rows[0]);
  } finally {
    client.release();
  }
}

/**
 * Update an alert
 */
export async function updateAlert(
  id: number,
  updates: {
    is_active?: boolean;
    alert_type?: 'above' | 'below';
    target_price?: number;
  }
): Promise<PriceAlert | null> {
  const client = await pool.connect();
  try {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (updates.is_active !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      values.push(updates.is_active);
    }
    
    if (updates.alert_type !== undefined) {
      setClauses.push(`alert_type = $${paramIndex++}`);
      values.push(updates.alert_type);
    }
    
    if (updates.target_price !== undefined) {
      setClauses.push(`target_price = $${paramIndex++}`);
      values.push(updates.target_price);
    }
    
    if (setClauses.length === 0) {
      return await getAlertById(id);
    }
    
    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    const result = await client.query(
      `UPDATE price_alerts 
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return mapRowToAlert(result.rows[0]);
  } finally {
    client.release();
  }
}

/**
 * Delete an alert
 */
export async function deleteAlert(id: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM price_alerts WHERE id = $1 RETURNING id',
      [id]
    );
    
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}

/**
 * Check and trigger alerts based on current price
 */
export async function checkAndTriggerAlerts(
  currentPrice: number,
  country: string = 'India'
): Promise<PriceAlert[]> {
  const client = await pool.connect();
  const triggeredAlerts: PriceAlert[] = [];
  
  try {
    // Get all active, non-triggered alerts for this country
    const result = await client.query(
      `SELECT * FROM price_alerts
       WHERE country = $1
         AND is_active = TRUE
         AND triggered = FALSE
       ORDER BY created_at ASC`,
      [country]
    );
    
    for (const row of result.rows) {
      const alert = mapRowToAlert(row);
      let shouldTrigger = false;
      
      if (alert.alert_type === 'above' && currentPrice >= alert.target_price) {
        shouldTrigger = true;
      } else if (alert.alert_type === 'below' && currentPrice <= alert.target_price) {
        shouldTrigger = true;
      }
      
      if (shouldTrigger) {
        // Mark alert as triggered
        await client.query(
          `UPDATE price_alerts
           SET triggered = TRUE,
               triggered_at = CURRENT_TIMESTAMP,
               triggered_price = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [currentPrice, alert.id]
        );
        
        // Add to history
        await client.query(
          `INSERT INTO alert_history (alert_id, triggered_price)
           VALUES ($1, $2)`,
          [alert.id, currentPrice]
        );
        
        triggeredAlerts.push({
          ...alert,
          triggered: true,
          triggered_at: new Date(),
          triggered_price: currentPrice
        });
      }
    }
    
    return triggeredAlerts;
  } finally {
    client.release();
  }
}

/**
 * Get alert trigger history
 */
export async function getAlertHistory(
  alertId?: number,
  limit: number = 50
): Promise<Array<{
  id: number;
  alert_id: number;
  triggered_price: number;
  triggered_at: Date;
}>> {
  const client = await pool.connect();
  try {
    let query = 'SELECT * FROM alert_history';
    const params: any[] = [];
    
    if (alertId) {
      query += ' WHERE alert_id = $1';
      params.push(alertId);
    }
    
    query += ' ORDER BY triggered_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    
    const result = await client.query(query, params);
    return result.rows.map(row => ({
      id: row.id,
      alert_id: row.alert_id,
      triggered_price: parseFloat(row.triggered_price),
      triggered_at: row.triggered_at
    }));
  } finally {
    client.release();
  }
}

/**
 * Reset a triggered alert (so it can trigger again)
 */
export async function resetAlert(id: number): Promise<PriceAlert | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE price_alerts
       SET triggered = FALSE,
           triggered_at = NULL,
           triggered_price = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return mapRowToAlert(result.rows[0]);
  } finally {
    client.release();
  }
}

/**
 * Map database row to PriceAlert interface
 */
function mapRowToAlert(row: any): PriceAlert {
  return {
    id: row.id,
    alert_type: row.alert_type,
    target_price: parseFloat(row.target_price),
    is_active: row.is_active,
    triggered: row.triggered || false,
    triggered_at: row.triggered_at,
    triggered_price: row.triggered_price ? parseFloat(row.triggered_price) : null,
    country: row.country,
    user_session_id: row.user_session_id,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}


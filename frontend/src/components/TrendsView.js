import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

function TrendsView() {
    // --- STATE MANAGEMENT ---
    const [chartType, setChartType] = useState('stacked');
    const [timeframe, setTimeframe] = useState('monthly');
    const [chartData, setChartData] = useState(null);
    const [insights, setInsights] = useState(null);
    const [loading, setLoading] = useState(true);
    const token = localStorage.getItem('token');

    // --- DATA FETCHING ---
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const config = { headers: { 'x-access-token': token } };
            
            try {
                // Fetch insights (dynamic to the timeframe)
                const insightsRes = await axios.get(`https://intellibudget.onrender.com/api/insights?timeframe=${timeframe}`, config);
                setInsights(insightsRes.data);

                // Fetch data for the selected chart type
                let res;
                switch (chartType) {
                    case 'bar':
                        res = await axios.get(`https://intellibudget.onrender.com/api/categorical_summary`, config);
                        setChartData({
                            type: 'bar',
                            data: {
                                labels: res.data.map(c => c._id),
                                datasets: [{ label: 'Total Spending', data: res.data.map(c => c.total), backgroundColor: 'rgba(153, 102, 255, 0.6)' }]
                            }
                        });
                        break;
                    case 'stacked':
                        const trendsTimeframe = timeframe === 'daily' ? 'D' : timeframe === 'weekly' ? 'W-MON' : 'ME';
                        res = await axios.get(`https://intellibudget.onrender.com/api/trends?timeframe_rule=${trendsTimeframe}`, config);
                        setChartData({ type: 'stacked', data: res.data });
                        break;
                    default:
                        setChartData(null);
                }
            } catch (error) {
                console.error("Failed to fetch chart data", error);
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchData();
        }
    }, [chartType, timeframe, token]);

    // --- RENDER LOGIC ---
    const renderChart = () => {
        if (!chartData || !chartData.data) return <p>No data available to display a chart.</p>;
        switch (chartData.type) {
            case 'bar':
                return <Bar options={{ indexAxis: 'y', responsive: true, plugins: { title: { display: true, text: `Total Spending by Category (All Time)` } } }} data={chartData.data} />;
            case 'stacked':
                return <Bar options={{ responsive: true, scales: { x: { stacked: true }, y: { stacked: true } }, plugins: { title: { display: true, text: 'Spending Over Time' } } }} data={chartData.data} />;
            default:
                return <p>Please select a chart type.</p>;
        }
    };

    return (
        <div>
            {/* --- THIS IS THE FIX --- */}
            {/* The div now uses the className="controls-panel" */}
            <div className="controls-panel">
                <div>
                    <strong>Chart Type: </strong>
                    <select value={chartType} onChange={(e) => setChartType(e.target.value)} className="form-select">
                        <option value="stacked">Spending Over Time</option>
                        <option value="bar">By Category (All Time)</option>
                    </select>
                </div>
                {/* Conditionally show timeframe selector only for relevant charts */}
                {(chartType === 'stacked') && (
                    <div>
                        <strong>Group By: </strong>
                        <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className="form-select">
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </div>
                )}
            </div>
            
            <div style={{ marginTop: '20px' }}>
                {loading ? <p>Loading chart data...</p> : renderChart()}
            </div>

            {/* Key Insights Section */}
            {!loading && insights && (
                <div style={{ marginTop: '30px' }}>
                    <h3>Key Insights</h3>
                    <div className="recommendation-text">
                        <p>📊 {insights.summary}</p>
                        {insights.average_spending && <p>📈 {insights.average_spending}</p>}
                        {insights.frequent_category && <p>🛍️ {insights.frequent_category}</p>}
                        {insights.consistency && <p>👍 {insights.consistency}</p>}
                    </div>
                </div>
            )}
        </div>
    );
}

export default TrendsView;
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    // State to manage button hover effect
    const [isHovered, setIsHovered] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('https://intellibudget.onrender.com/api/login', { email, password });
            localStorage.setItem('token', response.data.token);
            navigate('/dashboard');
        } catch (error) {
            alert('Login Failed!');
            console.error(error);
        }
    };

    // --- STYLES OBJECT ---
    const styles = {
        container: {
            maxWidth: '420px',
            margin: '5rem auto',
            padding: '2.5rem',
            backgroundColor: '#ffffff',
            borderRadius: '0.5rem',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            border: '1px solid #e5e7eb',
            textAlign: 'center',
        },
        header: {
            marginBottom: '1.5rem',
            color: '#111827',
            fontSize: '1.5rem',
            fontWeight: 600,
        },
        form: {
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
        },
        input: {
            width: '100%',
            padding: '0.75rem 1rem',
            fontSize: '1rem',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            boxSizing: 'border-box',
        },
        button: {
            padding: '0.75rem 1.25rem',
            fontSize: '1rem',
            fontWeight: 500,
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            backgroundColor: '#4f46e5',
            color: 'white',
            transition: 'background-color 0.2s ease-in-out',
        },
        buttonHover: {
            backgroundColor: '#4338ca',
        },
        footerText: {
            marginTop: '1.5rem',
            color: '#6b7280',
        },
        link: {
            color: '#4f46e5',
            fontWeight: 500,
            textDecoration: 'none',
        }
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.header}>Login</h2>
            <form onSubmit={handleLogin} style={styles.form}>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    required
                    style={styles.input}
                />
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    style={styles.input}
                />
                <button
                    type="submit"
                    style={isHovered ? {...styles.button, ...styles.buttonHover} : styles.button}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    Login
                </button>
            </form>
            <p style={styles.footerText}>
                Don't have an account? <Link to="/signup" style={styles.link}>Sign Up</Link>
            </p>
        </div>
    );
}

export default LoginPage;
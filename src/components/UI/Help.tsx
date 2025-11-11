import React, { useState, useEffect } from 'react';
import './Help.css';

const Help = ({ data, className = '' }) => {
    const [key, setKey] = useState(0);
    useEffect(() => {
        setKey(prev => prev + 1);
    }, [data]);

    if (!data) return null;

    return (
        <div
            key={key}
            className={`help-tooltip ${className}`}
            dangerouslySetInnerHTML={{ __html: data  }}
        />
    );
};

export default Help;
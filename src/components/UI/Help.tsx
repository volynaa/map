import { useState, useEffect } from 'react';
import './Help.css';

interface HelpProps {
    data?: string | null;
    className?: string;
}

interface InnerHTML {
    __html: string;
}

const Help = ({ data, className = '' }: HelpProps) => {
    const [key, setKey] = useState(0);
    useEffect(() => {
        setKey(prev => prev + 1);
    }, [data]);

    if (!data) return null;

    const htmlContent: InnerHTML = {
        __html: data
    };

    return (
        <div
            key={key}
            className={`help-tooltip ${className}`}
            dangerouslySetInnerHTML={htmlContent}
        />
    );
};

export default Help;
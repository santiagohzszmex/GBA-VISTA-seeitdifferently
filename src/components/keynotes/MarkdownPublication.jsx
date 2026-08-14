import React from 'react';
import ReactMarkdown from 'react-markdown';

export default function MarkdownPublication({ children }) {
  return (
    <ReactMarkdown
      components={{
        h1: props => <h2 className="font-serif italic text-3xl md:text-4xl mt-12 mb-5 text-[#1d1d1f]" {...props}/>,
        h2: props => <h2 className="font-serif italic text-2xl md:text-3xl mt-12 mb-5 text-[#1d1d1f]" {...props}/>,
        h3: props => <h3 className="text-lg font-bold mt-9 mb-4 text-[#1d1d1f]" {...props}/>,
        p: props => <p className="text-[15px] md:text-base leading-8 text-[#454549] mb-6" {...props}/>,
        ul: props => <ul className="list-disc pl-6 space-y-3 mb-7 text-[#454549]" {...props}/>,
        ol: props => <ol className="list-decimal pl-6 space-y-3 mb-7 text-[#454549]" {...props}/>,
        li: props => <li className="pl-1 leading-7" {...props}/>,
        blockquote: props => <blockquote className="border-l-2 border-[#0066FF] pl-5 my-8 font-serif italic text-xl text-[#343438]" {...props}/>,
        a: props => <a className="text-[#0066FF] underline underline-offset-4" target="_blank" rel="noreferrer" {...props}/>,
        strong: props => <strong className="font-bold text-[#1d1d1f]" {...props}/>,
        hr: () => <hr className="my-10 border-[#d2d2d7]/70"/>
      }}
    >
      {children || ''}
    </ReactMarkdown>
  );
}

import React from 'react';
import { ArrowRight, Zap, Share2, Layout } from 'lucide-react';

const LandingPage = ({ onGetStarted }) => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex flex-col">
            {/* Navbar */}
            <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">
                        AI
                    </div>
                    <span className="font-bold text-xl text-gray-900">Diagram Maker</span>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="flex-1 flex flex-col justify-center items-center text-center px-4 py-20 relative overflow-hidden">
                {/* Background Blobs */}
                <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
                <div className="absolute top-20 right-10 w-72 h-72 bg-orange-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>

                <div className="relative z-10 max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 backdrop-blur-sm border border-orange-100 text-orange-600 text-sm font-medium mb-8 shadow-sm">
                        <Zap size={16} className="fill-current" />
                        <span>Powered by Gemini</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight mb-8 leading-tight">
                        Turn Text into <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-500">
                            Diagrams
                        </span>
                    </h1>

                    <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
                        Describe your workflow, system, or idea in plain English, and watch as AI instantly transforms it into a professional diagram.
                    </p>

                    <button
                        onClick={onGetStarted}
                        className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-orange-500 font-pj rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 hover:bg-orange-600 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                    >
                        Get Started Now
                        <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>

                {/* Features Grid */}
                <div className="grid md:grid-cols-3 gap-8 mt-24 max-w-5xl mx-auto relative z-10">
                    {[
                        { icon: <Zap className="text-amber-500" />, title: "Instant Generation", desc: "From text to diagram in seconds using advanced AI." },
                        { icon: <Layout className="text-blue-500" />, title: "Multiple Types", desc: "Flowcharts, Sequence, Class, and State diagrams supported." },
                        { icon: <Share2 className="text-green-500" />, title: "Easy Export", desc: "Download as SVG or PNG." }
                    ].map((feature, idx) => (
                        <div key={idx} className="bg-white/60 backdrop-blur-md p-6 rounded-2xl border border-white/50 shadow-sm hover:shadow-md transition-all">
                            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-4 mx-auto">
                                {feature.icon}
                            </div>
                            <h3 className="font-bold text-gray-900 mb-2">{feature.title}</h3>
                            <p className="text-gray-600 text-sm">{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </main>


        </div>
    );
};

export default LandingPage;

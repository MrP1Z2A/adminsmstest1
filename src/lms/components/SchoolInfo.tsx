import React, { useEffect, useState } from 'react';
import { supabase } from '../src/supabaseClient';
import { isUnicornSchoolLogo } from '../../shared/branding/unicornSchoolLogo';

interface SchoolInfoProps {
  schoolId: string;
}

export default function SchoolInfo({ schoolId }: SchoolInfoProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInfo = async () => {
      if (!schoolId || !supabase) {
        setIsLoading(false);
        return;
      }
      const { data: school } = await supabase
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .single();
      
      if (school) setData(school);
      setIsLoading(false);
    };
    void fetchInfo();
  }, [schoolId]);

  if (isLoading || !data) return null;
  const isUnicornLogo = isUnicornSchoolLogo(data.logo_url);

  return (
    <div className="space-y-12 animate-fadeIn">
      {/* Banner */}
      {data.banner_url && (
        <div className="w-full h-64 rounded-[40px] overflow-hidden border border-white/20 shadow-2xl">
          <img src={data.banner_url} alt="Campus" className="w-full h-full object-cover" />
        </div>
      )}

      {/* About Section */}
      <section className="bg-white/10 backdrop-blur-2xl p-8 sm:p-12 rounded-[48px] border border-white/20 shadow-premium relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10">
           <i className="fa-solid fa-school text-9xl text-slate-900"></i>
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
          {data.logo_url && (
            <div className={`${isUnicornLogo ? 'w-44 h-24 rounded-[28px] bg-[#121A33] p-3' : 'w-32 h-32 rounded-3xl'} overflow-hidden border-2 border-[#4ea59d] shadow-lg shrink-0`}>
               <img src={data.logo_url} alt="Logo" className={`w-full h-full ${isUnicornLogo ? 'object-contain' : 'object-cover'}`} />
            </div>
          )}
          <div className="space-y-6">
            <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">About {data.name}</h3>
            <p className="text-slate-700 text-lg leading-relaxed font-medium max-w-4xl">
              {data.about || "Welcome to our esteemed institution. We are dedicated to providing excellence in education and fostering a community of lifelong learners."}
            </p>
          </div>
        </div>
      </section>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#0a1a19]/60 backdrop-blur-xl p-8 rounded-[32px] border border-white/10 flex items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-[#4ea59d]/20 flex items-center justify-center text-[#4ea59d] text-2xl">
            <i className="fa-solid fa-phone"></i>
          </div>
          <div>
            <p className="text-[10px] font-black text-[#4ea59d] uppercase tracking-widest mb-1">Contact Phone</p>
            <p className="text-slate-900 font-bold">{data.phone || "Not provided"}</p>
          </div>
        </div>

        <div className="bg-[#0a1a19]/60 backdrop-blur-xl p-8 rounded-[32px] border border-white/10 flex items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400 text-2xl">
            <i className="fa-solid fa-envelope"></i>
          </div>
          <div>
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Official Email</p>
            <p className="text-slate-900 font-bold">{data.email || "Not provided"}</p>
          </div>
        </div>

        <div className="bg-[#0a1a19]/60 backdrop-blur-xl p-8 rounded-[32px] border border-white/10 flex items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-400 text-2xl">
            <i className="fa-solid fa-location-dot"></i>
          </div>
          <div>
            <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Campus Address</p>
            <p className="text-slate-900 font-bold text-sm">{data.address || "Not provided"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

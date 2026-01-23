import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { validateAuth, unauthorizedResponse, forbiddenResponse, corsHeaders } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate authentication and require admin role
  const auth = await validateAuth(req);
  if (auth.error || !auth.user) {
    return unauthorizedResponse(auth.error || 'Unauthorized');
  }
  if (!auth.isAdmin) {
    return forbiddenResponse('Admin access required to run scraping functions');
  }

  try {
    console.log('Starting test data generation...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create scraping log entry
    const { data: logEntry, error: logError } = await supabase
      .from('scraping_logs')
      .insert({
        source: 'test',
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (logError) throw logError;

    // Generate 15 realistic mock opportunities
    const mockOpportunities = [
      {
        event_name: "React Summit 2025",
        event_url: "https://test.example.com/react-summit-2025",
        deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        location: "Amsterdam, Netherlands",
        description: "The biggest React conference in Europe. Looking for talks on React 19, Server Components, Performance Optimization, and Modern State Management patterns.",
        organizer_name: "GitNation",
        organizer_email: "speakers@reactsummit.test",
        event_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        audience_size: 1500,
        fee_estimate_min: 1000,
        fee_estimate_max: 3000,
        source: 'test',
        is_active: true
      },
      {
        event_name: "PyCon US 2025",
        event_url: "https://test.example.com/pycon-us-2025",
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        location: "Pittsburgh, PA, USA",
        description: "Annual Python conference seeking talks on Machine Learning, Data Science, Web Development with Django/FastAPI, and Python internals.",
        organizer_name: "Python Software Foundation",
        organizer_email: "program@pycon.test",
        event_date: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
        audience_size: 3000,
        fee_estimate_min: 500,
        fee_estimate_max: 1500,
        source: 'test',
        is_active: true
      },
      {
        event_name: "KubeCon + CloudNativeCon Europe",
        event_url: "https://test.example.com/kubecon-eu-2025",
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        location: "Paris, France",
        description: "Premier cloud native conference. Topics: Kubernetes, Service Mesh, Observability, GitOps, Platform Engineering, and Cloud Security.",
        organizer_name: "CNCF",
        organizer_email: "cfp@kubecon.test",
        event_date: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000).toISOString(),
        audience_size: 5000,
        fee_estimate_min: 2000,
        fee_estimate_max: 5000,
        source: 'test',
        is_active: true
      },
      {
        event_name: "AI DevWorld 2025",
        event_url: "https://test.example.com/ai-devworld-2025",
        deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        location: "San Jose, CA, USA",
        description: "Conference focused on practical AI/ML implementation. Seeking talks on LLMs, RAG systems, AI agents, model deployment, and ethical AI.",
        organizer_name: "DevNetwork",
        organizer_email: "speakers@aidevworld.test",
        event_date: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000).toISOString(),
        audience_size: 1200,
        fee_estimate_min: 1500,
        fee_estimate_max: 4000,
        source: 'test',
        is_active: true
      },
      {
        event_name: "JSConf Japan",
        event_url: "https://test.example.com/jsconf-japan-2025",
        deadline: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString(),
        location: "Tokyo, Japan",
        description: "JavaScript community conference covering TypeScript, Node.js, Deno, Modern frameworks, WebAssembly, and JavaScript tooling.",
        organizer_name: "JSConf",
        organizer_email: "cfp@jsconf.test",
        event_date: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString(),
        audience_size: 800,
        fee_estimate_min: 800,
        fee_estimate_max: 2500,
        source: 'test',
        is_active: true
      },
      {
        event_name: "DevOps Days Austin",
        event_url: "https://test.example.com/devopsdays-austin-2025",
        deadline: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        location: "Austin, TX, USA",
        description: "Community-driven DevOps conference. Topics include CI/CD, Infrastructure as Code, SRE practices, Monitoring, and Team culture.",
        organizer_name: "DevOpsDays Organizers",
        organizer_email: "organizers@devopsdays.test",
        event_date: new Date(Date.now() + 85 * 24 * 60 * 60 * 1000).toISOString(),
        audience_size: 400,
        fee_estimate_min: 0,
        fee_estimate_max: 500,
        source: 'test',
        is_active: true
      },
      {
        event_name: "Mobile World Congress",
        event_url: "https://test.example.com/mwc-2025",
        deadline: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
        location: "Barcelona, Spain",
        description: "World's largest mobile conference. Looking for sessions on 5G, IoT, Mobile App Development (iOS/Android), React Native, and Flutter.",
        organizer_name: "GSMA",
        organizer_email: "speakers@mwc.test",
        event_date: new Date(Date.now() + 110 * 24 * 60 * 60 * 1000).toISOString(),
        audience_size: 10000,
        fee_estimate_min: 3000,
        fee_estimate_max: 8000,
        source: 'test',
        is_active: true
      },
      {
        event_name: "Security BSides Virtual",
        event_url: "https://test.example.com/bsides-virtual-2025",
        deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
        location: "Virtual",
        description: "Online security conference covering Web Security, Cloud Security, Penetration Testing, Application Security, and Security Automation.",
        organizer_name: "BSides Organizers",
        organizer_email: "cfp@bsides.test",
        event_date: new Date(Date.now() + 70 * 24 * 60 * 60 * 1000).toISOString(),
        audience_size: 2000,
        fee_estimate_min: 0,
        fee_estimate_max: 1000,
        source: 'test',
        is_active: true
      },
      {
        event_name: "Data Engineering Summit",
        event_url: "https://test.example.com/data-eng-summit-2025",
        deadline: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
        location: "London, UK",
        description: "Conference for data professionals. Topics: Data Pipelines, ETL/ELT, Apache Spark, Streaming, Data Quality, and Modern Data Stack.",
        organizer_name: "Data Summit Org",
        organizer_email: "submissions@datasummit.test",
        event_date: new Date(Date.now() + 95 * 24 * 60 * 60 * 1000).toISOString(),
        audience_size: 900,
        fee_estimate_min: 1200,
        fee_estimate_max: 3000,
        source: 'test',
        is_active: true
      },
      {
        event_name: "GraphQL Galaxy",
        event_url: "https://test.example.com/graphql-galaxy-2025",
        deadline: new Date(Date.now() + 55 * 24 * 60 * 60 * 1000).toISOString(),
        location: "Virtual",
        description: "GraphQL-focused conference covering Schema Design, Federation, Performance, Apollo, Relay, and GraphQL tooling ecosystems.",
        organizer_name: "GraphQL Foundation",
        organizer_email: "program@graphqlgalaxy.test",
        event_date: new Date(Date.now() + 105 * 24 * 60 * 60 * 1000).toISOString(),
        audience_size: 600,
        fee_estimate_min: 500,
        fee_estimate_max: 1500,
        source: 'test',
        is_active: true
      },
      {
        event_name: "Serverless Architecture Conference",
        event_url: "https://test.example.com/serverless-arch-2025",
        deadline: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
        location: "Berlin, Germany",
        description: "Deep dive into serverless. Topics: AWS Lambda, Azure Functions, Google Cloud Functions, Event-driven architectures, and Cost optimization.",
        organizer_name: "Serverless Inc",
        organizer_email: "cfp@serverlessconf.test",
        event_date: new Date(Date.now() + 88 * 24 * 60 * 60 * 1000).toISOString(),
        audience_size: 700,
        fee_estimate_min: 1000,
        fee_estimate_max: 2500,
        source: 'test',
        is_active: true
      },
      {
        event_name: "UX Design Week",
        event_url: "https://test.example.com/ux-week-2025",
        deadline: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000).toISOString(),
        location: "Copenhagen, Denmark",
        description: "Design conference for UX professionals. Topics: User Research, Design Systems, Accessibility, Design Thinking, and Prototyping.",
        organizer_name: "UX Alliance",
        organizer_email: "speakers@uxweek.test",
        event_date: new Date(Date.now() + 115 * 24 * 60 * 60 * 1000).toISOString(),
        audience_size: 500,
        fee_estimate_min: 800,
        fee_estimate_max: 2000,
        source: 'test',
        is_active: true
      },
      {
        event_name: "RustConf",
        event_url: "https://test.example.com/rustconf-2025",
        deadline: new Date(Date.now() + 38 * 24 * 60 * 60 * 1000).toISOString(),
        location: "Portland, OR, USA",
        description: "Official Rust conference. Seeking talks on Systems Programming, WebAssembly, Async Rust, Embedded Systems, and Rust in Production.",
        organizer_name: "Rust Foundation",
        organizer_email: "cfp@rustconf.test",
        event_date: new Date(Date.now() + 108 * 24 * 60 * 60 * 1000).toISOString(),
        audience_size: 650,
        fee_estimate_min: 700,
        fee_estimate_max: 2000,
        source: 'test',
        is_active: true
      },
      {
        event_name: "API World",
        event_url: "https://test.example.com/api-world-2025",
        deadline: new Date(Date.now() + 48 * 24 * 60 * 60 * 1000).toISOString(),
        location: "Santa Clara, CA, USA",
        description: "World's largest API conference. Topics: REST, GraphQL, gRPC, API Security, API Gateway patterns, OpenAPI, and API Documentation.",
        organizer_name: "DevNetwork",
        organizer_email: "cfp@apiworld.test",
        event_date: new Date(Date.now() + 125 * 24 * 60 * 60 * 1000).toISOString(),
        audience_size: 2500,
        fee_estimate_min: 1500,
        fee_estimate_max: 4000,
        source: 'test',
        is_active: true
      },
      {
        event_name: "Tech Meetup Series - Boulder",
        event_url: "https://test.example.com/tech-meetup-boulder-2025",
        deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        location: "Boulder, CO, USA",
        description: "Local tech meetup seeking speakers on any software development topics. Great for first-time speakers!",
        organizer_name: "Boulder Tech Community",
        organizer_email: "meetup@bouldertech.test",
        event_date: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString(),
        audience_size: 50,
        fee_estimate_min: 0,
        fee_estimate_max: 0,
        source: 'test',
        is_active: true
      }
    ];

    let inserted = 0;
    let updated = 0;

    for (const opportunity of mockOpportunities) {
      // Check if opportunity already exists
      const { data: existing } = await supabase
        .from('opportunities')
        .select('id')
        .eq('event_url', opportunity.event_url)
        .single();

      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from('opportunities')
          .update(opportunity)
          .eq('id', existing.id);
        
        if (!updateError) updated++;
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('opportunities')
          .insert(opportunity);
        
        if (!insertError) inserted++;
      }
    }

    console.log(`Test data generation complete: ${inserted} inserted, ${updated} updated`);

    // Update scraping log
    await supabase
      .from('scraping_logs')
      .update({
        completed_at: new Date().toISOString(),
        status: 'success',
        opportunities_found: mockOpportunities.length,
        opportunities_inserted: inserted,
        opportunities_updated: updated
      })
      .eq('id', logEntry.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        found: mockOpportunities.length,
        inserted,
        updated
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Test data generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

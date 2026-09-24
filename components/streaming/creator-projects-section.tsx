import { fetchCreatorProjects } from '@/lib/streaming/chunk-data';
import { ProjectCard } from '@/components/project-card';
import { ArrowRight } from 'lucide-react';

export async function CreatorProjectsSection({ id }: { id: string }) {
  const projects = await fetchCreatorProjects(id);

  if (projects.length === 0) {
    return (
      <div className="p-8 rounded-lg border border-dashed border-border bg-muted/30 text-center">
        <p className="font-medium text-foreground mb-2">No projects published yet</p>
        <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
          This creator hasn't shared any projects yet. Check back soon to see their latest work,
          or head to your profile to publish your first project.
        </p>
        <a
          href="/profile/edit"
          className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium transition-colors"
        >
          <span>Add your first project</span>
          <ArrowRight size={16} />
        </a>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}

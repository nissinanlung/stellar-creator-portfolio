import { Suspense } from "react";
import { ProfileForm } from "@/components/forms/profile-form";
import GithubProfile from "@/components/ui/github-profile";
import SocialLinks from "@/components/ui/social-links";

export default function ProfileEditPage() {
    return (
        <div className="container max-w-2xl py-10">
            <div className="space-y-6">
                <div>
                    <h4 className="text-md font-medium">Profile Aggregation</h4>
                    <p className="text-sm text-muted-foreground">Preview external profile data (example: GitHub)</p>
                    <div className="mt-4">
                        {/* server component fetches public GitHub data for demo username */}
                        <Suspense fallback={
                            <div className="p-4 rounded-lg border bg-card animate-pulse flex items-center gap-4">
                                <div className="w-[72px] h-[72px] rounded-full bg-muted shrink-0" />
                                <div className="space-y-2 flex-1">
                                    <div className="h-5 bg-muted rounded w-1/3" />
                                    <div className="h-4 bg-muted rounded w-2/3" />
                                    <div className="h-3 bg-muted rounded w-1/2 mt-2" />
                                </div>
                            </div>
                        }>
                            <GithubProfile username="octocat" />
                        </Suspense>
                    </div>
                    <div className="mt-4">
                        <SocialLinks githubUrl="https://github.com/octocat" figmaUrl="" websiteUrl="" />
                    </div>
                </div>
                <div>
                    <h3 className="text-lg font-medium">Profile</h3>
                    <p className="text-sm text-muted-foreground">
                        Update your profile and link your social accounts.
                    </p>
                </div>
                <div className="border-t pt-6">
                    <ProfileForm />
                </div>
            </div>
        </div>
    );
}

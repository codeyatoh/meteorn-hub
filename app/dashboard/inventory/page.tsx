"use client";

import { useEffect, useState, useCallback, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Plus, Package, PencilIcon, TrashIcon, Share2, SearchIcon, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/ui/page-container";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { User } from "@supabase/supabase-js";
import { Combobox } from "@/components/ui/combobox";
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";
import { motion } from "motion/react";

type Account = {
  id: number;
  name: string;
};

type Post = {
  id: number;
  user_id: string;
  account_id: number;
  shoe_count: number;
  rarity: string;
  visibility: string;
  shared_credentials?: string;
  shared_with_nicknames?: string[];
  notes?: string;
  borrowed_by?: string;
  borrowed_by_nickname?: string;
  borrowed_at?: string;
  user_accounts: { name: string; email?: string };
};

const RARITY_OPTIONS = [
  { value: "common", label: "Common" },
  { value: "uncommon", label: "Uncommon" },
  { value: "super_uncommon", label: "Super Uncommon" },
];

const VISIBILITY_OPTIONS = [
  { value: "private", label: "Private (Only Me)" },
  { value: "public", label: "Public (Everyone)" },
  { value: "specific_users", label: "Specific Users" },
];

export default function InventoryPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allNicknames, setAllNicknames] = useState<{value: string, label: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Filtering state
  const [searchQuery, setSearchQuery] = useState("");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Pagination state
  const [myPostsPage, setMyPostsPage] = useState(1);
  const [sharedPostsPage, setSharedPostsPage] = useState(1);
  const POSTS_PER_PAGE = 8;

  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form State
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [shoeCount, setShoeCount] = useState("1");
  const [rarity, setRarity] = useState("common");
  const [visibility, setVisibility] = useState("private");
  const [sharedPassword, setSharedPassword] = useState("");
  const [sharedNicknames, setSharedNicknames] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);

    if (user) {
      const { data: accountsData } = await supabase
        .from("user_accounts")
        .select("id, name")
        .eq("user_id", user.id);
      if (accountsData) setAccounts(accountsData);
    }

    try {
      const res = await fetch('/api/users/nicknames');
      if (res.ok) {
        const { nicknames } = await res.json();
        setAllNicknames(nicknames.map((n: string) => ({ value: n, label: n })));
      }
    } catch (e) {
      console.error("Failed to fetch nicknames", e);
    }

    const { data: postsData } = await supabase
      .from("shoe_inventory_posts")
      .select("*, user_accounts(name, email)")
      .order("created_at", { ascending: false });

    if (postsData) setPosts(postsData);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (mounted) {
        await fetchData();
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [fetchData]);

  const resetForm = () => {
    setSelectedPostId(null);
    setSelectedAccountId("");
    setShoeCount("1");
    setRarity("common");
    setVisibility("private");
    setSharedPassword("");
    setSharedNicknames([]);
    setNotes("");
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return toast.error("Not authenticated");
    if (!selectedAccountId) return toast.error("Please select an account");

    setSubmitting(true);
    try {
      const { error } = await supabase.from("shoe_inventory_posts").insert({
        user_id: currentUser.id,
        account_id: parseInt(selectedAccountId),
        shoe_count: parseInt(shoeCount),
        rarity,
        visibility,
        shared_credentials: visibility !== "private" ? sharedPassword : null,
        shared_with_nicknames: visibility === "specific_users" ? sharedNicknames : [],
        notes
      });

      if (error) throw error;
      toast.success("Post created successfully!");
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create post");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedPostId) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("shoe_inventory_posts").update({
        account_id: parseInt(selectedAccountId),
        shoe_count: parseInt(shoeCount),
        rarity,
        visibility,
        shared_credentials: visibility !== "private" ? sharedPassword : null,
        shared_with_nicknames: visibility === "specific_users" ? sharedNicknames : [],
        notes
      }).eq('id', selectedPostId).eq('user_id', currentUser.id);

      if (error) throw error;
      toast.success("Post updated successfully!");
      setIsEditModalOpen(false);
      resetForm();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update post");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = async () => {
    if (!currentUser || !selectedPostId) return;

    setDeleting(true);
    try {
      setPosts(prev => prev.filter(p => p.id !== selectedPostId));
      
      const { error } = await supabase.from("shoe_inventory_posts").delete().eq('id', selectedPostId).eq('user_id', currentUser.id);
      
      if (error) {
        toast.error("Failed to delete post");
        fetchData(); 
      } else {
        toast.success("Post deleted successfully");
      }
      setIsDeleteModalOpen(false);
      resetForm();
    } finally {
      setDeleting(false);
    }
  };

  const openEditModal = (post: Post) => {
    setSelectedPostId(post.id);
    setSelectedAccountId(post.account_id.toString());
    setShoeCount(post.shoe_count.toString());
    setRarity(post.rarity);
    setVisibility(post.visibility);
    let password = post.shared_credentials || "";
    if (password.includes("::::")) {
      const parts = password.split("::::");
      password = parts[1];
    }
    setSharedPassword(password);
    setSharedNicknames(post.shared_with_nicknames || []);
    setNotes(post.notes || "");
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (id: number) => {
    setSelectedPostId(id);
    setIsDeleteModalOpen(true);
  };

  const handleBorrow = async (postId: number) => {
    if (!currentUser) return toast.error("Not authenticated");
    const nickname = currentUser.user_metadata?.nickname || "Unknown User";

    const loadingToast = toast.loading("Borrowing account...");
    try {
      const { error } = await supabase.rpc('borrow_shoe_post', { p_post_id: postId, p_nickname: nickname });
      if (error) throw error;
      toast.success("Successfully borrowed account!", { id: loadingToast });
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to borrow account", { id: loadingToast });
    }
  };

  const handleReturn = async (postId: number) => {
    const loadingToast = toast.loading("Returning account...");
    try {
      const { error } = await supabase.rpc('return_shoe_post', { p_post_id: postId });
      if (error) throw error;
      toast.success("Successfully returned account!", { id: loadingToast });
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to return account", { id: loadingToast });
    }
  };

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Credentials copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };


  const accountOptions = accounts.map(a => ({ value: a.id.toString(), label: a.name }));

  // Filtering logic
  const filteredPosts = posts.filter(post => {
    const matchesSearch = (post.user_accounts?.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRarity = rarityFilter === "all" || post.rarity === rarityFilter;
    const matchesStatus = statusFilter === "all" || (statusFilter === "borrowed" ? post.borrowed_by != null : post.borrowed_by == null);
    return matchesSearch && matchesRarity && matchesStatus;
  });

  const myPosts = filteredPosts.filter(p => p.user_id === currentUser?.id || p.borrowed_by === currentUser?.id);
  const sharedPosts = filteredPosts.filter(p => p.user_id !== currentUser?.id);

  const paginatedMyPosts = myPosts.slice((myPostsPage - 1) * POSTS_PER_PAGE, myPostsPage * POSTS_PER_PAGE);
  const totalMyPostsPages = Math.ceil(myPosts.length / POSTS_PER_PAGE);

  const paginatedSharedPosts = sharedPosts.slice((sharedPostsPage - 1) * POSTS_PER_PAGE, sharedPostsPage * POSTS_PER_PAGE);
  const totalSharedPostsPages = Math.ceil(sharedPosts.length / POSTS_PER_PAGE);

  const ShoeCard = ({ 
    post, 
    currentUser, 
    openEditModal, 
    openDeleteModal, 
    handleCopy, 
    copiedId, 
    handleReturn,
    handleBorrow
  }: {
    post: Post;
    currentUser: User | null;
    openEditModal: (post: Post) => void;
    openDeleteModal: (id: number) => void;
    handleCopy: (id: number, text: string) => void;
    copiedId: number | null;
    handleReturn: (id: number) => void;
    handleBorrow: (id: number) => void;
  }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const isBorrowed = post.borrowed_by != null;
    const isOwner = post.user_id === currentUser?.id;
    const isBorrower = post.borrowed_by === currentUser?.id;
    
    const getCardGradient = (r: string) => {
      switch (r) {
        case "uncommon": return "bg-gradient-to-br from-green-500/20 via-green-500/5 to-transparent";
        case "super_uncommon": return "bg-gradient-to-br from-purple-500/20 via-purple-500/5 to-transparent";
        default: return "bg-gradient-to-br from-neutral-500/15 via-neutral-500/5 to-transparent";
      }
    };
    
    let email = post.user_accounts?.email || "";
    let password = post.shared_credentials || "";
    if (password.includes("::::")) {
      const parts = password.split("::::");
      if (!email) email = parts[0];
      password = parts[1];
    }

    const canViewCredentials = isOwner || isBorrower;

    return (
      <motion.div 
        initial="rest"
        animate={isExpanded ? "hover" : "rest"}
        whileHover="hover"
        onClick={() => setIsExpanded(!isExpanded)}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
        variants={{ rest: { scale: 1, y: 0 } }}
        className="group flex flex-col w-full relative cursor-pointer"
      >
        <div className={`flex flex-col rounded-3xl border h-64 z-10 transition-colors w-full border-border hover:border-border/80 ${isBorrowed ? 'bg-muted/10 grayscale' : 'bg-background'}`}>
          <div className={`relative w-full h-full overflow-hidden px-5 pt-6 pb-4 flex flex-col gap-3 rounded-3xl ${getCardGradient(post.rarity)}`}>
            <div className="flex justify-between items-start z-20 gap-2">
              <span className="font-medium text-lg sm:text-xl tracking-tight text-foreground truncate drop-shadow-md min-w-0 flex-1">
                {post.user_accounts?.name}
              </span>
              
              <div className="flex gap-1.5 items-center shrink-0">
                {isOwner && (
                  <>
                    <span onClick={(e) => { e.stopPropagation(); openEditModal(post); }} className="text-[10px] uppercase font-bold text-muted-foreground hover:text-primary z-20 transition-colors cursor-pointer">Edit</span>
                    <span onClick={(e) => { e.stopPropagation(); openDeleteModal(post.id); }} className="text-[10px] uppercase font-bold text-muted-foreground hover:text-destructive z-20 transition-colors cursor-pointer">Delete</span>
                  </>
                )}
                {!isOwner && !isBorrowed && (
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="h-6 text-[10px] px-3 rounded-full uppercase font-bold z-20 tracking-wider shadow-sm"
                    onClick={(e) => { e.stopPropagation(); handleBorrow(post.id); }}
                  >
                    Borrow
                  </Button>
                )}
                {isBorrowed && (
                   <div className="z-20 bg-background/80 backdrop-blur-sm px-2 py-0.5 rounded-md border border-border/50 text-[10px] text-muted-foreground font-medium whitespace-nowrap">
                     Borrowed by {post.borrowed_by_nickname}
                   </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 z-20">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap">{post.rarity.replace("_", " ")}</span>
              <span className="text-muted-foreground/30 text-[9px] sm:text-[10px]">•</span>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground font-semibold whitespace-nowrap">{post.shoe_count} Shoe{post.shoe_count !== 1 ? 's' : ''}</span>
              <span className="text-muted-foreground/30 text-[9px] sm:text-[10px]">•</span>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground font-semibold capitalize whitespace-nowrap">{post.visibility.replace("_", " ")}</span>
            </div>
            
            {/* The Shoe Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={`/shoes/${post.rarity}.png`} 
              alt={post.rarity} 
              className="absolute inset-x-0 bottom-[-20px] mx-auto w-48 h-auto object-contain transition-transform duration-700 group-hover:scale-105 opacity-90 drop-shadow-xl z-0" 
              onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} 
            />
            

            
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/30 to-transparent z-10" />
          </div>
        </div>

          <motion.div
            variants={{
              rest: { opacity: 0.2, y: -30 },
              hover: { opacity: 1, y: 0 },
            }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="overflow-hidden z-0 w-11/12 self-center relative -mt-5 pt-5"
          >
            <div className="py-4 px-5 relative border-t-0 rounded-b-3xl border border-border bg-card shadow-sm">
              <div className="pointer-events-none w-[103%] bg-gradient-to-b from-background to-transparent h-12 absolute -top-1 -left-1 opacity-50" />
              
              <div className="flex flex-col gap-3 relative z-10 mt-1">
                 {!canViewCredentials && (
                   <div className="absolute inset-[-10px] z-20 flex flex-col items-center justify-center backdrop-blur-md bg-background/40 rounded-xl border border-border/50">
                     <Lock className="size-4 text-muted-foreground mb-1" />
                     <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center px-1">Borrow to reveal</span>
                   </div>
                 )}
                 
                 <div className={`flex justify-between items-center ${!canViewCredentials ? 'opacity-40 blur-[2px] select-none' : ''}`}>
                   <div className="flex flex-col min-w-0 flex-1 mr-2">
                     <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-0.5">Email</span>
                     <span className={`text-xs font-mono text-foreground truncate block ${canViewCredentials ? 'select-all' : ''}`}>{email || "N/A"}</span>
                   </div>
                   {canViewCredentials && (
                     <Button 
                       size="sm" 
                       variant="ghost" 
                       className="h-6 text-[10px] px-2 rounded-md uppercase font-bold text-muted-foreground hover:text-primary z-20 shrink-0"
                       onClick={(e) => { e.stopPropagation(); handleCopy(post.id + 9999, email); }}
                     >
                       {copiedId === (post.id + 9999) ? "Copied" : "Copy"}
                     </Button>
                   )}
                 </div>
                 
                 <div className={`flex justify-between items-center ${!canViewCredentials ? 'opacity-40 blur-[2px] select-none' : ''}`}>
                   <div className="flex flex-col min-w-0 flex-1 mr-2">
                     <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-0.5">Password</span>
                     <span className={`text-xs font-mono text-foreground truncate block ${canViewCredentials ? 'select-all' : ''}`}>{password || "N/A"}</span>
                   </div>
                   {canViewCredentials && (
                     <Button 
                       size="sm" 
                       variant="ghost" 
                       className="h-6 text-[10px] px-2 rounded-md uppercase font-bold text-muted-foreground hover:text-primary z-20 shrink-0"
                       onClick={(e) => { e.stopPropagation(); handleCopy(post.id, password); }}
                     >
                       {copiedId === post.id ? "Copied" : "Copy"}
                     </Button>
                   )}
                 </div>
                 
                 {(isBorrowed && (isOwner || isBorrower)) && (
                    <div className="pt-3 mt-1 border-t border-border/30 flex justify-end">
                      <Button 
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] px-3 uppercase font-bold text-orange-500 border-orange-500/20 hover:bg-orange-500/10 hover:text-orange-600 transition-colors z-20 shadow-sm"
                        onClick={(e) => { e.stopPropagation(); handleReturn(post.id); }}
                      >
                        {isOwner ? "Force Return" : "Return"}
                      </Button>
                    </div>
                 )}
              </div>
            </div>
          </motion.div>
      </motion.div>
    );
  };


  return (
    <PageContainer>
      <div className="mb-6">
        <div className="inline-flex items-center justify-center px-3 py-1 text-[10px] font-mono font-medium tracking-widest text-primary uppercase bg-primary/10 rounded-full mb-3">
          <Package className="size-3 mr-2" />
          Shoe Inventory
        </div>
        <div className="flex items-center justify-between gap-4 mt-3 sm:mt-0">
          <h1 className="font-heading text-3xl sm:text-4xl text-foreground">
            Shoe Inventory
          </h1>
        </div>
        <p className="mt-2 text-muted-foreground text-sm">
          Manage your shoes and share them with the community.
        </p>
      </div>
      
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 bg-background/40 p-3 rounded-xl border border-border/60">
        <div className="relative flex-1 min-w-[200px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search account name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-input rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex gap-2">
          <div className="w-full sm:w-[150px]">
            <Combobox 
              options={[
                { value: "all", label: "All Rarities" },
                { value: "common", label: "Common" },
                { value: "uncommon", label: "Uncommon" },
                { value: "super_uncommon", label: "Super Uncommon" }
              ]} 
              value={rarityFilter} 
              onValueChange={setRarityFilter} 
            />
          </div>
          <div className="w-full sm:w-[150px]">
            <Combobox 
              options={[
                { value: "all", label: "All Status" },
                { value: "available", label: "Available" },
                { value: "borrowed", label: "Borrowed" }
              ]} 
              value={statusFilter} 
              onValueChange={setStatusFilter} 
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="my_inventory" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="my_inventory">My Inventory</TabsTrigger>
          <TabsTrigger value="shared">Shared Hub</TabsTrigger>
        </TabsList>

        <TabsContent value="my_inventory" className="mt-0">
          <DashboardCard 
            title="My Shoe Accounts" 
            trailing={
              <Button onClick={() => { resetForm(); setIsModalOpen(true); }} variant="ghost" size="sm" className="h-8 px-2 sm:px-3">
                <Plus className="size-3.5 sm:size-4 sm:mr-1" />
                <span className="hidden sm:inline text-xs">Add Post</span>
              </Button>
            }
          >
            {loading ? (
              <p className="text-muted-foreground text-sm p-4">Loading inventory...</p>
            ) : myPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Package className="size-10 text-muted-foreground mb-3 opacity-20" />
                <p className="text-muted-foreground text-sm">No accounts found.</p>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-12">
                  {paginatedMyPosts.map(post => (
                    <ShoeCard 
                      key={post.id} 
                      post={post} 
                      currentUser={currentUser} 
                      openEditModal={openEditModal} 
                      openDeleteModal={openDeleteModal} 
                      handleCopy={handleCopy} 
                      copiedId={copiedId} 
                      handleReturn={handleReturn}
                      handleBorrow={handleBorrow}
                    />
                  ))}
                </div>
                <PaginationControls 
                  currentPage={myPostsPage} 
                  totalPages={totalMyPostsPages} 
                  onPageChange={setMyPostsPage} 
                />
              </div>
            )}
          </DashboardCard>
        </TabsContent>

        <TabsContent value="shared" className="mt-0">
          <DashboardCard title="Available Shared Accounts">
            {loading ? (
              <p className="text-muted-foreground text-sm p-4">Loading shared posts...</p>
            ) : sharedPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Share2 className="size-10 text-muted-foreground mb-3 opacity-20" />
                <p className="text-muted-foreground text-sm">No shared accounts found.</p>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-12">
                  {paginatedSharedPosts.map(post => (
                    <ShoeCard 
                      key={post.id} 
                      post={post} 
                      currentUser={currentUser} 
                      openEditModal={openEditModal} 
                      openDeleteModal={openDeleteModal} 
                      handleCopy={handleCopy} 
                      copiedId={copiedId} 
                      handleReturn={handleReturn}
                      handleBorrow={handleBorrow}
                    />
                  ))}
                </div>
                <PaginationControls 
                  currentPage={sharedPostsPage} 
                  totalPages={totalSharedPostsPages} 
                  onPageChange={setSharedPostsPage} 
                />
              </div>
            )}
          </DashboardCard>
        </TabsContent>
      </Tabs>

      {/* Add Modal */}
      <AnimatedModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add to Inventory" icon={<Package className="size-5 text-primary-foreground" />}>
        <div className="p-6">
          <form onSubmit={handleCreatePost} className="space-y-4">
            <FormFields 
              accountOptions={accountOptions} selectedAccountId={selectedAccountId} setSelectedAccountId={setSelectedAccountId}
              shoeCount={shoeCount} setShoeCount={setShoeCount} rarity={rarity} setRarity={setRarity} visibility={visibility} setVisibility={setVisibility}
              allNicknames={allNicknames} sharedNicknames={sharedNicknames} setSharedNicknames={setSharedNicknames}
              sharedPassword={sharedPassword} setSharedPassword={setSharedPassword} notes={notes} setNotes={setNotes}
            />
            <div className="pt-4 flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save Post"}</Button>
            </div>
          </form>
        </div>
      </AnimatedModal>

      {/* Edit Modal */}
      <AnimatedModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Post" icon={<PencilIcon className="size-5 text-primary-foreground" />}>
        <div className="p-6">
          <form onSubmit={handleUpdatePost} className="space-y-4">
            <FormFields 
              accountOptions={accountOptions} selectedAccountId={selectedAccountId} setSelectedAccountId={setSelectedAccountId}
              shoeCount={shoeCount} setShoeCount={setShoeCount} rarity={rarity} setRarity={setRarity} visibility={visibility} setVisibility={setVisibility}
              allNicknames={allNicknames} sharedNicknames={sharedNicknames} setSharedNicknames={setSharedNicknames}
              sharedPassword={sharedPassword} setSharedPassword={setSharedPassword} notes={notes} setNotes={setNotes}
            />
            <div className="pt-4 flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Updating..." : "Update Post"}</Button>
            </div>
          </form>
        </div>
      </AnimatedModal>

      {/* Delete Modal */}
      <AnimatedModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Post" icon={<TrashIcon className="size-5 text-primary-foreground" />}>
        <div className="p-6">
          <p className="text-sm text-muted-foreground mb-6">Are you sure you want to delete this post? This action cannot be undone.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeletePost} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete Post"}
            </Button>
          </div>
        </div>
      </AnimatedModal>
    </PageContainer>
  );
}

function DashboardCard({ title, trailing, children }: { title: string; trailing?: ReactNode; children: ReactNode; }) {
  return (
    <section className="flex flex-col h-full rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest sm:tracking-[0.25em]">
          {title}
        </div>
        {trailing}
      </div>
      <div className="flex flex-col flex-1">
        {children}
      </div>
    </section>
  );
}

interface FormFieldsProps {
  accountOptions: { value: string; label: string }[];
  selectedAccountId: string;
  setSelectedAccountId: (val: string) => void;
  shoeCount: string;
  setShoeCount: (val: string) => void;
  rarity: string;
  setRarity: (val: string) => void;
  visibility: string;
  setVisibility: (val: string) => void;
  allNicknames: { value: string; label: string }[];
  sharedNicknames: string[];
  setSharedNicknames: (val: string[]) => void;
  sharedPassword: string;
  setSharedPassword: (val: string) => void;
  notes: string;
  setNotes: (val: string) => void;
}

function FormFields({
  accountOptions, selectedAccountId, setSelectedAccountId,
  shoeCount, setShoeCount, rarity, setRarity, visibility, setVisibility,
  allNicknames, sharedNicknames, setSharedNicknames,
  sharedPassword, setSharedPassword, notes, setNotes
}: FormFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label>Select Account</Label>
        <Combobox
          options={accountOptions}
          value={selectedAccountId}
          onValueChange={setSelectedAccountId}
          placeholder="Select an account..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Shoe Count</Label>
          <Input type="number" min="1" value={shoeCount} onChange={e => setShoeCount(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Rarity</Label>
          <Combobox options={RARITY_OPTIONS} value={rarity} onValueChange={setRarity} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Visibility</Label>
        <Combobox options={VISIBILITY_OPTIONS} value={visibility} onValueChange={setVisibility} />
      </div>

      {visibility === "specific_users" && (
        <div className="space-y-2">
          <Label>Share with Nicknames</Label>
          <MultiSelectCombobox
            options={allNicknames}
            values={sharedNicknames}
            onValuesChange={setSharedNicknames}
            placeholder="Select users to share with..."
          />
        </div>
      )}

      {visibility !== "private" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Password (Optional)</Label>
            <Input 
              placeholder="e.g. pass123" 
              value={sharedPassword}
              onChange={e => setSharedPassword(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">Only visible to the user who borrows this account.</p>
        </div>
      )}

      <div className="space-y-2">
        <Label>Notes (Optional)</Label>
        <Input 
          placeholder="Any extra details..." 
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>
    </>
  );
}

function PaginationControls({
  currentPage,
  totalPages,
  onPageChange
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages === 0) return null;
  return (
    <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/40">
      <button 
        onClick={() => onPageChange(currentPage - 1)} 
        disabled={currentPage === 1}
        className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        Prev
      </button>
      <div className="text-[10px] font-mono text-muted-foreground">
        {currentPage} / {totalPages}
      </div>
      <button 
        onClick={() => onPageChange(currentPage + 1)} 
        disabled={currentPage === totalPages}
        className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        Next
      </button>
    </div>
  );
}

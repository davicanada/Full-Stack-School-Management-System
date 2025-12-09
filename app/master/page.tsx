'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { supabase } from '@/lib/supabase/client';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  institution_id?: string;
  created_at?: string;
}

interface AccessRequest {
  id: string;
  name: string;
  email: string;
  request_type: string;
  status: string;
  new_institution_name?: string;
  new_institution_address?: string;
  new_institution_city?: string;
  new_institution_state?: string;
  institution_id?: string;
  created_at: string;
}

interface Institution {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  created_at?: string;
}

export default function MasterPage() {
  // Main states
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('solicitacoes');

  // Request states
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  // User states
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userInstitutionFilter, setUserInstitutionFilter] = useState('');

  // Institution states
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(false);

  const router = useRouter();

  // Function to fetch pending requests (extracted for global use)
  const fetchPendingRequests = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('access_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching requests:', error);
        toast.error('Error loading requests');
        return;
      }

      setRequests(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error loading requests');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Check authentication and user role
  useEffect(() => {
    const checkAuth = () => {
      const userDate = localStorage.getItem('user');
      if (!userDate) {
        toast.error('Access denied. Please log in first.');
        router.push('/');
        return;
      }

      const parsedUser = JSON.parse(userDate);
      if (parsedUser.role !== 'master') {
        toast.error('Access denied. Only master users can access this page.');
        router.push('/');
        return;
      }

      setUser(parsedUser);
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    const fetchInstitutions = async () => {
      try {
        const { data, error } = await supabase
          .from('institutions')
          .select('*');

        if (error) {
          console.error('Error fetching institutions:', error);
          return;
        }

        setInstitutions(data || []);
      } catch (error) {
        console.error('Error:', error);
      }
    };

    if (user) {
      fetchPendingRequests();
      fetchInstitutions();
    }
  }, [user, fetchPendingRequests]);

  // Fetch all system users
  const fetchAllUsers = async () => {
    try {
      setUsersLoading(true);

      // Fetch basic users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersError) {
        console.error('Error fetching users:', usersError);
        toast.error('Error loading users');
        return;
      }

      if (!users || users.length === 0) {
        setAllUsers([]);
        return;
      }

      console.log('📊 Users found:', users.length);

      // For teachers without institution_id, fetch through user_institutions
      const professorsWithoutInstitution = users.filter(user =>
        user.role === 'professor' && !user.institution_id
      );

      console.log('👨‍🏫 Teachers without institution_id:', professorsWithoutInstitution.length);

      if (professorsWithoutInstitution.length > 0) {
        // Fetch teacher institutions through user_institutions
        const professorIds = professorsWithoutInstitution.map(prof => prof.id);

        const { data: userInstitutions, error: userInstError } = await supabase
          .from('user_institutions')
          .select(`
            user_id,
            institution_id,
            institutions!inner(
              id,
              name
            )
          `)
          .in('user_id', professorIds);

        if (userInstError) {
          console.error('❌ Error fetching user_institutions:', userInstError);
        } else {
          console.log('🔗 User_institutions found:', userInstitutions?.length || 0);

          // Mapping to facilitate search
          const institutionMap = new Map();
          userInstitutions?.forEach(ui => {
            institutionMap.set(ui.user_id, {
              institution_id: ui.institution_id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              institution_name: (ui.institutions as any)?.name || (ui.institutions as any)?.[0]?.name || 'N/A'
            });
          });

          // Update teachers with institution data
          professorsWithoutInstitution.forEach(professor => {
            const instInfo = institutionMap.get(professor.id);
            if (instInfo) {
              professor.institution_id = instInfo.institution_id;
              professor._institution_name = instInfo.institution_name;
              console.log(`✅ Teacher ${professor.name} → ${instInfo.institution_name}`);
            } else {
              console.log(`❌ Teacher ${professor.name} → NO INSTITUTION`);
            }
          });
        }
      }

      setAllUsers(users);
    } catch (error) {
      console.error('❌ Critical error:', error);
      toast.error('Error loading users');
    } finally {
      setUsersLoading(false);
    }
  };

  // Fetch all institutions with counters
  const fetchAllInstitutions = async () => {
    try {
      setInstitutionsLoading(true);

      const { data, error } = await supabase
        .from('institutions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching institutions:', error);
        toast.error('Error loading institutions');
        return;
      }

      setInstitutions(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error loading institutions');
    } finally {
      setInstitutionsLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('user');
    toast.success('Logout successful!');
    router.push('/');
  };

  // Function to format request type
  const formatRequestType = (requestType: string) => {
    switch (requestType) {
      case 'admin_new':
        return 'Administrator - New Institution';
      case 'admin_existing':
        return 'Administrator - Existing Institution';
      case 'professor':
        return 'Teacher';
      default:
        return requestType;
    }
  };

  // Function to format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Function to approve requests
  const handleApprove = async (request: AccessRequest) => {
    if (!user) return;

    try {
      setIsProcessing(true);
      setProcessingRequestId(request.id);

      console.log('Processing approval for:', request);

      if (request.request_type === 'admin_new') {
        // 1. Create new institution
        const { data: newInstitution, error: instError } = await supabase
          .from('institutions')
          .insert({
            name: request.new_institution_name,
            address: request.new_institution_address,
            city: request.new_institution_city,
            state: request.new_institution_state
          })
          .select()
          .single();

        if (instError) {
          console.error('Error creating institution:', instError);
          throw new Error('Error creating institution');
        }

        console.log('Institution created:', newInstitution);

        // 2. Create admin user
        const { data: newAdminUser, error: userError } = await supabase
          .from('users')
          .insert({
            email: request.email,
            name: request.name,
            password_hash: 'senha123',
            role: 'admin',
            institution_id: newInstitution.id
          })
          .select()
          .single();

        if (userError) {
          console.error('Error creating admin user:', userError);
          throw new Error('Error creating admin user');
        }

        console.log('Admin user created successfully');

        // 3. Also add to user_institutions table for multiple institutions support
        console.log('🔗 Adding admin to user_institutions...');

        // Prepare insert data
        const insertDate = {
          user_id: newAdminUser.id,
          institution_id: newInstitution.id,
          role: 'admin' // Define specific role for this institution
        };

        console.log('📋 Date to be inserted in user_institutions:', insertDate);

        const { error: relationError } = await supabase
          .from('user_institutions')
          .insert(insertDate);

        if (relationError) {
          console.warn('Error adding admin to user_institutions (non-critical):', relationError);
          // Don't fail approval because of this, since admin already has institution_id
        } else {
          console.log('Admin also added to user_institutions for future multiple institutions support');
        }

      } else if (request.request_type === 'admin_existing') {
        console.log('🟡 PROCESSING ADMIN_EXISTING APPROVAL - ALWAYS CREATING NEW USER');

        // SIMPLIFIED: Always create new user (1 email = 1 user)
        const { data: newAdminUser, error: userError } = await supabase
          .from('users')
          .insert({
            email: request.email,
            name: request.name,
            password_hash: 'senha123',
            role: 'admin',
            institution_id: request.institution_id
          })
          .select()
          .single();

        if (userError) {
          console.error('❌ Error creating admin user:', userError);
          throw new Error(`Error creating admin user: ${userError.message}`);
        }

        console.log('✅ New admin user created:', newAdminUser);

        // Also add to user_institutions table
        const { error: relationError } = await supabase
          .from('user_institutions')
          .insert({
            user_id: newAdminUser.id,
            institution_id: request.institution_id,
            role: 'admin'
          });

        if (relationError) {
          console.warn('❌ Error creating link in user_institutions (non-critical):', relationError);
        }

        console.log('✅ ADMIN_EXISTING APPROVAL COMPLETED SUCCESSFULLY!');

      } else if (request.request_type === 'professor') {
        console.log('🟡 PROCESSING TEACHER APPROVAL - ALWAYS CREATING NEW USER');

        if (!request.institution_id) {
          throw new Error('Institution ID not found in request');
        }

        // SIMPLIFIED: Always create new user (1 email = 1 user)
        console.log('Creating user WITH institution_id (consistent system)');

        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            email: request.email,
            name: request.name,
            password_hash: 'senha123',
            role: 'professor',
            is_active: true,
            institution_id: request.institution_id  // ADDED BACK for consistency
          })
          .select()
          .single();

        if (userError) {
          console.error('❌ Error creating teacher user:', userError);
          throw new Error(`Error creating teacher user: ${userError.message}`);
        }

        console.log('✅ New teacher user created:', newUser);

        // Add to user_institutions table (for future consistency)
        console.log('Teacher has direct institution_id + link in user_institutions for consistency:', {
          user_id: newUser.id,
          institution_id: request.institution_id,
          role: 'professor'
        });

        const { error: userInstError } = await supabase
          .from('user_institutions')
          .insert({
            user_id: newUser.id,
            institution_id: request.institution_id,
            role: 'professor'
          });

        if (userInstError) {
          console.error('❌ Error linking teacher to institution:', userInstError);
          throw new Error(`Error linking teacher to institution: ${userInstError.message}`);
        }

        // Check if link was created
        const { data: checkLink } = await supabase
          .from('user_institutions')
          .select('*')
          .eq('user_id', newUser.id)
          .eq('institution_id', request.institution_id)
          .single();

        console.log('Link created?', checkLink);

        console.log('✅ TEACHER APPROVAL COMPLETED SUCCESSFULLY!');
      }

      // 3. Update request status
      const { error: updateError } = await supabase
        .from('access_requests')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (updateError) {
        console.error('Error updating request:', updateError);
        throw new Error('Error updating request status');
      }

      console.log('Request approved successfully');
      toast.success(`Request from ${request.name} approved successfully!`);

      // Reload request list
      await fetchPendingRequests();

    } catch (error: unknown) {
      console.error('Error approving request:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error approving request';
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
      setProcessingRequestId(null);
    }
  };

  // Function to reject requests
  const handleReject = async (request: AccessRequest) => {
    if (!user) return;

    try {
      setIsProcessing(true);
      setProcessingRequestId(request.id);

      console.log('Processing rejection for:', request);

      // Update request status
      const { error: updateError } = await supabase
        .from('access_requests')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (updateError) {
        console.error('Error rejecting request:', updateError);
        throw new Error('Error updating request status');
      }

      console.log('Request rejected successfully');
      toast.success(`Request from ${request.name} rejected.`);

      // Reload request list
      await fetchPendingRequests();

    } catch (error: unknown) {
      console.error('Error rejecting request:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error rejecting request';
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
      setProcessingRequestId(null);
    }
  };

  // Function to delete user
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!user) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete user "${userName}"?\n\nThis action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      setUsersLoading(true);

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) {
        console.error('Error deleting user:', error);
        toast.error('Error deleting user. Check permissions.');
        return;
      }

      toast.success(`User "${userName}" deleted successfully!`);
      await fetchAllUsers(); // Reload user list

    } catch (error) {
      console.error('Error:', error);
      toast.error('Internal error deleting user');
    } finally {
      setUsersLoading(false);
    }
  };

  // Function to delete institution
  const handleDeleteInstitution = async (institutionId: string, institutionName: string) => {
    if (!user) return;

    // Check if there are linked users
    const usersInInstitution = getUserCountByInstitution(institutionId);

    if (usersInInstitution > 0) {
      toast.error(`Cannot delete institution "${institutionName}" because it has ${usersInInstitution} linked user(s).`);
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete institution "${institutionName}"?\n\nThis action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      setInstitutionsLoading(true);

      const { error } = await supabase
        .from('institutions')
        .delete()
        .eq('id', institutionId);

      if (error) {
        console.error('Error deleting institution:', error);
        toast.error('Error deleting institution. Check permissions.');
        return;
      }

      toast.success(`Institution "${institutionName}" deleted successfully!`);
      await fetchAllInstitutions(); // Reload institution list

      // If we're on the users tab, also reload to update filters
      if (activeTab === 'usuarios') {
        await fetchAllUsers();
      }

    } catch (error) {
      console.error('Error:', error);
      toast.error('Internal error deleting institution');
    } finally {
      setInstitutionsLoading(false);
    }
  };

  // Function to edit user (placeholder)
  const handleEditUser = () => {
    toast('User editing functionality under development', { icon: '🔧' });
  };

  // Function to edit institution (placeholder)
  const handleEditInstitution = () => {
    toast('Institution editing functionality under development', { icon: '🔧' });
  };

  // Function to view institution details (placeholder)
  const handleViewInstitutionDetails = (institutionId: string) => {
    const usersCount = getUserCountByInstitution(institutionId);
    toast(`Institution has ${usersCount} linked user(s)`, { icon: 'ℹ️' });
  };

  // Helper functions for filters and search
  const getInstitutionName = (user: User | { institution_id?: string; _institution_name?: string }) => {
    // If it's a user object, use _institution_name first
    if (user && typeof user === 'object' && '_institution_name' in user && user._institution_name) {
      return user._institution_name;
    }

    // If it's a user object, get institution_id
    const institutionId = user && typeof user === 'object' ? user.institution_id : user;

    if (!institutionId) return 'No institution';
    const institution = institutions.find(inst => inst.id === institutionId);
    return institution ? institution.name : 'Institution not found';
  };

  // Filter users based on active filters
  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(userSearchTerm.toLowerCase());
    const matchesRole = userRoleFilter === '' || user.role === userRoleFilter;
    const matchesInstitution = userInstitutionFilter === '' || user.institution_id === userInstitutionFilter;

    return matchesSearch && matchesRole && matchesInstitution;
  });

  // Count users by institution
  const getUserCountByInstitution = (institutionId: string) => {
    return allUsers.filter(user => user.institution_id === institutionId).length;
  };

  // Handler for tab change
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);

    // Load specific tab data when necessary
    if (tab === 'usuarios' && allUsers.length === 0) {
      fetchAllUsers();
    } else if (tab === 'instituicoes' && institutions.length === 0) {
      fetchAllInstitutions();
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-purple-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Master Panel - Full Control
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Welcome, {user.name}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Tab System */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => handleTabChange('solicitacoes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'solicitacoes'
                  ? 'border-red-500 text-red-600 dark:text-red-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              📋 Pending Requests
            </button>

            <button
              onClick={() => handleTabChange('usuarios')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'usuarios'
                  ? 'border-red-500 text-red-600 dark:text-red-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              👥 All Users
            </button>

            <button
              onClick={() => handleTabChange('instituicoes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'instituicoes'
                  ? 'border-red-500 text-red-600 dark:text-red-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              🏢 All Institutions
            </button>

            <button
              onClick={() => handleTabChange('logs')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'logs'
                  ? 'border-red-500 text-red-600 dark:text-red-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              📊 System Logs
            </button>

            <button
              onClick={() => handleTabChange('configuracoes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'configuracoes'
                  ? 'border-red-500 text-red-600 dark:text-red-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              ⚙️ Settings
            </button>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">

        {/* TAB: PENDING REQUESTS */}
        {activeTab === 'solicitacoes' && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Pending Requests
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Manage all system access requests
              </p>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-300">Loading requests...</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No pending requests
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  All requests have been processed.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {requests.map((request) => (
                  <div key={request.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {request.name}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300">
                          {request.email}
                        </p>
                        <span className="inline-block mt-2 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm font-medium rounded-full">
                          {formatRequestType(request.request_type)}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(request.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* Specific data based on request type */}
                    {request.request_type === 'admin_new' && (
                      <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <h4 className="font-medium text-purple-800 dark:text-purple-300 mb-2">
                          New Institution:
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <p><strong>Name:</strong> {request.new_institution_name}</p>
                          <p><strong>City:</strong> {request.new_institution_city}</p>
                          <p><strong>State:</strong> {request.new_institution_state}</p>
                          <p className="md:col-span-2"><strong>Address:</strong> {request.new_institution_address}</p>
                        </div>
                      </div>
                    )}

                    {request.request_type === 'admin_existing' && request.institution_id && (
                      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
                          Existing Institution:
                        </h4>
                        <p className="text-sm">
                          <strong>Name:</strong> {getInstitutionName(request)}
                        </p>
                      </div>
                    )}

                    {request.request_type === 'professor' && request.institution_id && (
                      <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                        <h4 className="font-medium text-orange-800 dark:text-orange-300 mb-2">
                          Institution:
                        </h4>
                        <p className="text-sm">
                          <strong>Name:</strong> {getInstitutionName(request)}
                        </p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="mt-6 flex gap-3">
                      <button
                        onClick={() => handleApprove(request)}
                        disabled={isProcessing}
                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {isProcessing && processingRequestId === request.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Approving...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Approve
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleReject(request)}
                        disabled={isProcessing}
                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {isProcessing && processingRequestId === request.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Rejecting...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Reject
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: ALL USERS */}
        {activeTab === 'usuarios' && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                All Users
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Manage all registered users in the system
              </p>
            </div>

            {/* Filters and search */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Search user
                  </label>
                  <input
                    type="text"
                    placeholder="Name or email..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Filter by role
                  </label>
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">All roles</option>
                    <option value="master">Master</option>
                    <option value="admin">Admin</option>
                    <option value="professor">Teacher</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Filter by institution
                  </label>
                  <select
                    value={userInstitutionFilter}
                    onChange={(e) => setUserInstitutionFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">All institutions</option>
                    {institutions.map(inst => (
                      <option key={inst.id} value={inst.id}>{inst.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setUserSearchTerm('');
                      setUserRoleFilter('');
                      setUserInstitutionFilter('');
                    }}
                    className="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>

            {/* User list */}
            {usersLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-300">Loading users...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No users found
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Try adjusting the search filters.
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Institution
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Registration Date
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredUsers.map((userItem) => (
                        <tr key={userItem.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {userItem.name}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {userItem.email}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 text-xs font-semibold rounded-full ${
                              userItem.role === 'master' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              userItem.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                              'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                            }`}>
                              {userItem.role.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {getInstitutionName(userItem)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {userItem.created_at ? formatDate(userItem.created_at) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleEditUser()}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition-colors"
                              >
                                Edit
                              </button>
                              {userItem.id !== user?.id && (
                                <button
                                  onClick={() => handleDeleteUser(userItem.id, userItem.name)}
                                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs transition-colors"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: ALL INSTITUTIONS */}
        {activeTab === 'instituicoes' && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                All Institutions
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Manage all registered institutions in the system
              </p>
            </div>

            {institutionsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-300">Loading institutions...</p>
              </div>
            ) : institutions.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No institutions found
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Approved institutions will appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {institutions.map((institution) => (
                  <div key={institution.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {institution.name}
                      </h3>
                      <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                        <p><strong>Address:</strong> {institution.address}</p>
                        <p><strong>City:</strong> {institution.city} - {institution.state}</p>
                        <p><strong>Users:</strong> {getUserCountByInstitution(institution.id)}</p>
                        {institution.created_at && (
                          <p><strong>Created at:</strong> {formatDate(institution.created_at)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewInstitutionDetails(institution.id)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => handleEditInstitution(institution.id, institution.name)}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteInstitution(institution.id, institution.name)}
                        className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: SYSTEM LOGS */}
        {activeTab === 'logs' && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                System Logs
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                View all important actions performed in the system
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Feature Under Development
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Soon you will be able to view all important system action logs.
              </p>
            </div>
          </div>
        )}

        {/* TAB: SETTINGS */}
        {activeTab === 'configuracoes' && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                System Settings
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Configure global system parameters
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Feature Under Development
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Soon you will be able to configure global system parameters, such as email settings, notifications, etc.
              </p>
            </div>
          </div>
        )}

      </main>

      <Toaster position="top-right" />
    </div>
  );
}
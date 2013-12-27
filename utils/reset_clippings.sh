#!/bin/sh
#
# Utility for reinitializing Clippings test environment
#

script_name=`basename $0`
env=
ext_install_file="{91aa5abe-9de4-4347-b7b5-322c38dd9271}"
ds_file="clipdat2.rdf"
ds_backup_dir=".clipbak"
pref_file="prefs.js"
tmp_pref_file="_new_prefs.js"
opt_whichapp=

# The following constants are to be used as values of $opt_whichapp
OPT_APP_FX=1
OPT_APP_TB=2

# Values of $env
ENV_CYGWIN=1


print_usage()
{
    echo "Usage: $script_name [hostapp] [command]...
Where hostapp is one of:
  -F        Firefox
  -T        Thunderbird

Commands:
  -f        Reset v2 first-run pref
  -v        Reset v3 first-run pref
  -d        Delete profile datasource file and backup directory
  -r        Delete common datasource file and backup directory
  -u        Uninstall Clippings
  -i        Reinstall Clippings

Environment variables:
  \$PROFDIR_FX    Path to Firefox profile directory
  \$PROFDIR_TB    Path to Thunderbird profile directory" >&2
    exit 0
}


check_opts()
{
    if [ -z "$opt_whichapp" ] ; then
	echo "$script_name: Must specify one of -F or -T" >&2
	exit 1
    fi

    return 0
}


detect_os_env()
{   
    [ -n `uname | grep "CYGWIN"` ] && env=$ENV_CYGWIN
    return 0
}


get_home_dir()
{
    # Return value stored in global variable "$rv"
    if [ "$env" = $ENV_CYGWIN ] ; then
	rv=`echo \`cygpath --unix $USERPROFILE\``
    else
	rv=$HOME
    fi

    return 0
}


set_pref()
{
    pref_name="$1"
    old_pref_value="$2"
    new_pref_value="$3"
    check_opts

    if [ $opt_whichapp = $OPT_APP_FX ] ; then
	cd "$PROFDIR_FX"
    elif [ $opt_whichapp = $OPT_APP_TB ] ; then
	cd "$PROFDIR_TB"
    fi

    eval "sed 's/\(\"${pref_name}\", \)${old_pref_value}/\1${new_pref_value}/' ${pref_file} > ${tmp_pref_file}"
    rm $pref_file
    mv $tmp_pref_file $pref_file

    return 0
}


remove_ds()
{
    # This takes a string parameter that specifies the datasource
    # directory; if none is specified, then the host app profile directory
    # is used
    ds_path="$1"
    if [ -z "$ds_path" ] ; then
	if [ $opt_whichapp = $OPT_APP_FX ] ; then
	    ds_path="$PROFDIR_FX"
	elif [ $opt_whichapp = $OPT_APP_TB ] ; then
	    ds_path="$PROFDIR_TB"
	fi
    fi

    check_opts

    cd "$ds_path"
    rm $ds_file
    rm -rf $ds_backup_dir

    return 0
}


uninst()
{
    check_opts

    if [ $opt_whichapp = $OPT_APP_FX ] ; then
	install_path="$PROFDIR_FX/extensions"
    elif [ $opt_whichapp = $OPT_APP_TB ] ; then
	install_path="$PROFDIR_TB/extensions"
    fi

    cd $install_path
    mv $ext_install_file "~${ext_install_file}~"

    return 0
}


reinst()
{
    check_opts

    if [ $opt_whichapp = $OPT_APP_FX ] ; then
	install_path="$PROFDIR_FX/extensions"
    elif [ $opt_whichapp = $OPT_APP_TB ] ; then
	install_path="$PROFDIR_TB/extensions"
    fi

    cd $install_path
    mv "~${ext_install_file}~" $ext_install_file

    return 0
}



#
# Script execution starts here
#

detect_os_env

if [ $# -lt 1 ] ; then
    print_usage
    exit 1
fi

if [ -z "$PROFDIR_FX" -a -z "$PROFDIR_TB" ] ; then
    echo "$script_name: Environment variables not defined" >&2
    exit 1
fi

while getopts "FTcdfimruv" option
do
  case $option in
      F)  opt_whichapp=$OPT_APP_FX ;;
      T)  opt_whichapp=$OPT_APP_TB ;;
      d)  remove_ds ;;
      f)  set_pref "clippings.first_run" "false" "true" ;;
      i)  reinst ;;
      r)  get_home_dir ; remove_ds "$rv" ;;
      u)  uninst ;;
      v)  set_pref "clippings.v3.first_run" "false" "true" ;;
      \?) print_usage ;;
  esac
done
shift `expr $OPTIND - 1`

exit $?

